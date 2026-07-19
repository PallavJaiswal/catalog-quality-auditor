import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ColumnMapping, RawCatalogRow } from "./types";

// What we get back after parsing any file
export interface ParsedFile {
  headers: string[];        // column names from the file
  rows: Record<string, string>[]; // raw rows as key-value pairs
  filename: string;
}

// ─── Main entry point ───────────────────────────────────────
// Accepts any supported file type and returns the same shape.
// The rest of the app never needs to know what file type 
// was uploaded.
export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || name.endsWith(".tsv")) {
    return parseDelimited(file);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseExcel(file);
  }

  throw new Error(
    `Unsupported file type. Please upload a .csv, .tsv, or .xlsx file.`
  );
}

// ─── CSV / TSV parser ────────────────────────────────────────
function parseDelimited(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,          // use first row as column names
      skipEmptyLines: true,  // ignore blank rows
      dynamicTyping: false,  // keep everything as strings for now
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        resolve({
          headers,
          rows: results.data,
          filename: file.name,
        });
      },
      error: (err: Error) => reject(err),
    });
  });
}

// ─── Excel parser ────────────────────────────────────────────
async function parseExcel(file: File): Promise<ParsedFile> {
  // Read file as binary buffer
  const buffer = await file.arrayBuffer();

  // Parse with SheetJS
  const workbook = XLSX.read(buffer, { type: "array" });

  // Use the first sheet only
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to array of objects
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
    sheet,
    { defval: "", raw: false } // empty cells = "", everything as string
  );

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return { headers, rows, filename: file.name };
}

// ─── Image counting ──────────────────────────────────────────
// Counts how many images a listing actually has. Real files show
// up in two shapes: several separate columns (image_1, image_2 —
// each non-empty column is one image), or a single column packed
// with a whole list of image URLs (as JSON, e.g. ["url1","url2"]).
// This handles both without over- or under-counting.
function countImages(
  row: Record<string, string>,
  columns: string[]
): number {
  let total = 0;

  for (const col of columns) {
    const raw = (row[col] ?? "").trim();
    if (!raw) continue;

    // Looks like a JSON array, e.g. ["url1", "url2", "url3"]
    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          total += parsed.length;
          continue;
        }
      } catch {
        // Not valid JSON after all — fall through and try the
        // next approach instead of crashing.
      }
    }

    // Looks like several URLs joined together in one cell
    const urlMatches = raw.match(/https?:\/\//g);
    if (urlMatches && urlMatches.length > 1) {
      total += urlMatches.length;
      continue;
    }

    // Otherwise, treat this column as a single image slot
    total += 1;
  }

  return total;
}

// ─── Apply column mapping ────────────────────────────────────
// Takes raw rows + the user's column mapping and produces
// clean RawCatalogRow objects our app understands.
export function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): RawCatalogRow[] {
  return rows.map((row) => {
    // Merge multiple bullet columns into one pipe-separated string
    const bulletValues = mapping.bullets
      .map((col) => (row[col] ?? "").trim())
      .filter(Boolean);
    const bullets = bulletValues.join("|");

    const imageCount = countImages(row, mapping.image_count);

    return {
      sku:         (row[mapping.sku]         ?? "").trim(),
      title:       (row[mapping.title]       ?? "").trim(),
      bullets,
      description: (row[mapping.description] ?? "").trim(),
      category:    (row[mapping.category]    ?? "").trim(),
      brand:       (row[mapping.brand]       ?? "").trim(),
      image_count: String(imageCount),
      price:       (row[mapping.price]       ?? "").trim(),
      parent_sku:  (row[mapping.parent_sku]  ?? "").trim(),
      product_url: (row[mapping.product_url] ?? "").trim(),
    };
  });
}

// ─── Guess column mapping ────────────────────────────────────
// Tries to auto-detect which column maps to which field.
//
// How it works, in plain terms: real-world catalog files rarely
// use our exact field names. A header like "brandName" or
// "current_depth" gets broken into its actual words — ["brand",
// "name"], ["current", "depth"] — and we score how closely those
// words match what we're looking for. An exact word match beats a
// word merely appearing inside another, so a plain "name" column
// is always preferred over "brandName" as a match for "title,"
// and "current_depth" no longer falsely matches "category" just
// because "depth" happens to contain the letters "dept."

// Splits a header like "brandName" or "current_depth" or
// "Image Count" into its individual lowercase words.
function tokenize(header: string): string[] {
  return header
    // insert a space before capital letters: "brandName" -> "brand Name"
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // treat underscores, hyphens, and dots as word breaks too
    .replace(/[_\-.]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

// Scores how well a header matches a candidate phrase (which may
// itself be more than one word, e.g. "product name"). Higher is
// better; 0 means no real match.
function scoreMatch(headerTokens: string[], candidate: string): number {
  const candidateTokens = tokenize(candidate);

  // Every word in the candidate must appear (or nearly appear,
  // to allow for plurals like "feature"/"features") in the header.
  const allPresent = candidateTokens.every((c) =>
    headerTokens.some((h) => h === c || h.startsWith(c) || c.startsWith(h))
  );
  if (!allPresent) return 0;

  // A header made of exactly the candidate's words scores highest.
  // Extra words in the header (the "brand" in "brandName") lower
  // the score — this is what stops "brandName" from outranking a
  // plain "name" column when we're looking for a title.
  const extraWords = headerTokens.length - candidateTokens.length;
  return 100 - extraWords * 15;
}

// Finds the single best-matching header across all candidate
// phrases. Returns "" if nothing matches well enough.
function find(headers: string[], candidates: string[]): string {
  let best = "";
  let bestScore = 0;

  for (const candidate of candidates) {
    for (const header of headers) {
      const score = scoreMatch(tokenize(header), candidate);
      if (score > bestScore) {
        bestScore = score;
        best = header;
      }
    }
  }

  return best;
}

// Same idea, but returns every header that matches well enough —
// used for bullets/images, which real marketplace files often
// spread across several columns instead of just one.
function findAll(headers: string[], candidates: string[]): string[] {
  return headers.filter((header) =>
    candidates.some((c) => scoreMatch(tokenize(header), c) > 0)
  );
}

export function guessMapping(headers: string[]): ColumnMapping {
  return {
    sku: find(headers, [
      "sku", "item id", "product id", "asin", "upc", "gtin", "mpn",
    ]),
    title: find(headers, [
      "title", "product name", "item name", "name",
    ]),
    bullets: findAll(headers, [
      "bullet", "bullets", "feature", "features", "key point",
      "highlights",
    ]),
    description: find(headers, [
      "description", "desc", "about", "summary",
    ]),
    category: find(headers, [
      "category", "breadcrumbs", "breadcrumb",
      "item type keyword", "product type keyword", "item type",
      "product type", "department", "node name",
    ]),
    brand: find(headers, [
      "brand", "brand name", "manufacturer", "vendor", "maker",
    ]),
    image_count: findAll(headers, [
      "image", "images", "photo", "photos", "img", "picture",
      "gallery",
    ]),
    // "standard/sale/selling/current price" are what the item
    // actually sells for — ranked above "list price" on purpose,
    // since marketplace flat files (Amazon in particular) use
    // "list_price" for the strike-through "was" price, not the
    // real selling price. Matching it first would silently audit
    // the wrong number for every listing.
    price: find(headers, [
      "standard price", "selling price", "sale price",
      "current price", "unit price", "price", "cost", "msrp",
      "listed price", "list price",
    ]),
    // Optional — only present in files with a parent/child
    // variation model (e.g. Amazon flat files). Blank when the
    // file has no such column, which is the common case. Deliberately
    // doesn't match a bare "parent" — that would also catch
    // "parent_child" (Amazon's Parent/Child *role* indicator, not
    // a SKU) and poison every row with the same non-SKU value.
    parent_sku: find(headers, [
      "parent sku", "parent asin", "parent id",
    ]),
    // Optional — a link to the product's page on the manufacturer's
    // site or elsewhere, used to generate copy grounded in the real
    // page instead of from scratch. Deliberately requires a second
    // word alongside "url"/"link" — a bare "url" or "link" candidate
    // would also match "main_image_url" / "other_image_url1" and
    // silently steal an image column instead.
    product_url: find(headers, [
      "product url", "product link", "manufacturer url",
      "manufacturer link", "landing page", "source url",
      "reference url", "external url", "brand url",
      "detail page url",
    ]),
  };
}
