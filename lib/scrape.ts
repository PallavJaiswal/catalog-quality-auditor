import dns from "node:dns/promises";
import net from "node:net";

// ─── Limits ──────────────────────────────────────────────────
const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 2_000_000; // 2MB — plenty for a product page
const MAX_EXTRACTED_CHARS = 8000;     // keeps the AI prompt a sane size
const MAX_REDIRECTS = 3;

export class ScrapeError extends Error {}

export interface FetchedPage {
  url: string;
  title: string;
  metaDescription: string;
  text: string;
}

// ─── SSRF guard ──────────────────────────────────────────────
// The URL comes from an uploaded file — untrusted input. Without
// this, a row with product_url set to an internal address would
// have our server fetch it on the visitor's behalf (classic SSRF).
// This checks the protocol, rejects local hostnames, and resolves
// the DNS name to make sure it doesn't point at a private/loopback
// address — checking the *resolved* address, not just the hostname
// string, since a public-looking hostname can still resolve to an
// internal IP (DNS rebinding).
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80")
    );
  }
  return true; // not a recognizable IP format — treat as unsafe
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ScrapeError("That doesn't look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScrapeError("Only http/https links are supported.");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new ScrapeError(
      "That URL points to a local address, which isn't allowed."
    );
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new ScrapeError("Couldn't resolve that URL's address.");
  }

  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new ScrapeError(
      "That URL points to a private or internal address, which isn't allowed."
    );
  }

  return url;
}

// ─── Fetch with manual redirect validation ──────────────────
// Each hop is re-validated through the same SSRF guard — a public
// hostname could still redirect to an internal address.
async function fetchValidated(rawUrl: string): Promise<Response> {
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CatalogQualityAuditor/1.0; +product-content-fetch)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new ScrapeError("That page took too long to respond.");
      }
      throw new ScrapeError(
        "Couldn't reach that page — it may be down or blocking automated requests."
      );
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new ScrapeError("That page redirected without a destination.");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return res;
  }

  throw new ScrapeError("That page redirected too many times.");
}

// ─── HTML → readable text ────────────────────────────────────
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘");
}

function extractTagText(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function extractMetaContent(html: string, name: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`,
      "i"
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]).trim();
  }
  return "";
}

function extractReadableText(html: string): string {
  const stripped = html
    // Remove elements whose content is never useful body copy
    .replace(/<(script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    // Block-level tags become line breaks so words don't run together
    .replace(/<\/(p|div|li|tr|h[1-6]|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(stripped)
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_EXTRACTED_CHARS);
}

// ─── Main entry point ────────────────────────────────────────
export async function fetchProductPage(rawUrl: string): Promise<FetchedPage> {
  const res = await fetchValidated(rawUrl);

  if (!res.ok) {
    throw new ScrapeError(
      `That page returned an error (HTTP ${res.status}) — it may block automated requests.`
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new ScrapeError("That URL doesn't point to a web page.");
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new ScrapeError("Couldn't read that page's content.");
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const html = Buffer.concat(chunks).toString("utf-8");

  const title =
    extractTagText(html, "title") || extractMetaContent(html, "og:title");
  const metaDescription =
    extractMetaContent(html, "description") ||
    extractMetaContent(html, "og:description");
  const text = extractReadableText(html);

  if (text.length < 100) {
    throw new ScrapeError(
      "Couldn't find readable content on that page — it may render everything " +
        "with JavaScript, which this tool can't execute."
    );
  }

  return { url: rawUrl, title, metaDescription, text };
}
