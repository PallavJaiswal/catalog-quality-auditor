import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

// Per-visitor AI usage cap, enforced server-side via a signed,
// httpOnly cookie — not localStorage. localStorage only gates the
// UI; a visitor could still hit the API routes directly with no
// limit at all. This cookie is read and written by the API routes
// themselves, so the cap holds regardless of what the client does.
export type AiFeature =
  | "rewrite"
  | "compliance"
  | "duplicate-verdict"
  | "summary"
  | "generate-from-link";

const COOKIE_NAME = "cqa_usage";
const LIMIT_PER_FEATURE = 2;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — the cap persists across visits, not just one session

// Signs the cookie so a visitor can't just edit the count to 0 in
// devtools. This is cost-control for a public demo, not a real
// security boundary — the fallback below is a fixed string baked
// into a public repo, so anyone could read it and forge a cookie by
// hand. Set USAGE_COOKIE_SECRET in production (e.g. Vercel env
// vars) to a real random value so that isn't possible. Unlike a
// random-per-instance secret, a fixed fallback still works
// correctly across Vercel's multiple serverless instances, which
// don't share memory.
const SECRET =
  process.env.USAGE_COOKIE_SECRET ??
  "cqa-demo-fallback-secret-set-USAGE_COOKIE_SECRET-in-production";

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

function parseCookie(
  raw: string | undefined
): Partial<Record<AiFeature, number>> {
  if (!raw) return {};
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return {};
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (sign(payload) !== signature) return {};
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8")
    );
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function serializeCookie(counts: Partial<Record<AiFeature, number>>): string {
  const payload = Buffer.from(JSON.stringify(counts)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function getCounts(request: NextRequest): Partial<Record<AiFeature, number>> {
  return parseCookie(request.cookies.get(COOKIE_NAME)?.value);
}

export function getRemaining(
  request: NextRequest,
  feature: AiFeature
): number {
  const used = getCounts(request)[feature] ?? 0;
  return Math.max(0, LIMIT_PER_FEATURE - used);
}

// Call only after the AI call actually succeeds — a failed attempt
// shouldn't cost the visitor their budget. Sets the updated cookie
// on the given response and returns how many uses remain.
export function consume(
  request: NextRequest,
  response: NextResponse,
  feature: AiFeature
): number {
  const counts = getCounts(request);
  const used = (counts[feature] ?? 0) + 1;
  response.cookies.set(COOKIE_NAME, serializeCookie({ ...counts, [feature]: used }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return Math.max(0, LIMIT_PER_FEATURE - used);
}

export function limitReachedResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "This demo allows 2 free uses of this AI feature per visitor. Thanks for trying it out — feel free to explore everything else in the tool.",
      limitReached: true,
    },
    { status: 429 }
  );
}

export const AI_FEATURE_LIMIT = LIMIT_PER_FEATURE;
