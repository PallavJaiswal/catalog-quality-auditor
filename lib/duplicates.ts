import type { AuditedListing } from "./types";

// Hard duplicate threshold — definitely the same product
const DUPLICATE_THRESHOLD = 0.8;

// Soft warning threshold — possibly the same product
const POSSIBLE_DUPLICATE_THRESHOLD = 0.5;

// ─── Variation families ──────────────────────────────────────
// Marketplace flat files (Amazon in particular) group color/size
// variants under a shared parent SKU. Those siblings are *meant*
// to have near-identical titles — that's the parent/child model
// working correctly, not a duplicate listing. Two listings are in
// the same family if they share a non-empty parentSku, or if one
// listing's own SKU is the other's parentSku (parent vs its child).
//
// Files with no parent/child column (every parentSku === "")
// fall through untouched — the original title-similarity check
// still runs on every pair, which is exactly what a flat, non-
// variation marketplace (eBay, a generic catalog export) needs:
// there, two near-identical titles usually *are* a real duplicate.
function getParentSkus(listings: AuditedListing[]): Set<string> {
  const parents = new Set<string>();
  for (const l of listings) {
    if (l.parentSku) parents.add(l.parentSku);
  }
  return parents;
}

function isSameVariationFamily(
  a: AuditedListing,
  b: AuditedListing
): boolean {
  if (a.parentSku && b.parentSku && a.parentSku === b.parentSku) {
    return true;
  }
  if (a.parentSku && a.parentSku === b.sku) return true;
  if (b.parentSku && b.parentSku === a.sku) return true;
  return false;
}

// ─── Jaccard similarity ──────────────────────────────────────
function jaccardSimilarity(
  titleA: string,
  titleB: string
): number {
  const wordsA = new Set(normalizeTitle(titleA).split(" "));
  const wordsB = new Set(normalizeTitle(titleB).split(" "));

  const intersection = new Set(
    [...wordsA].filter((word) => wordsB.has(word))
  );
  const union = new Set([...wordsA, ...wordsB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// ─── Normalize title ─────────────────────────────────────────
function normalizeTitle(title: string): string {
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "for", "of",
    "with", "in", "on", "at", "to", "from", "by",
    "is", "it", "its", "this", "that",
  ]);

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !stopWords.has(w))
    .join(" ");
}

// ─── Main duplicate detection ────────────────────────────────
export function detectDuplicates(
  listings: AuditedListing[]
): AuditedListing[] {
  const result = listings.map((l) => ({ ...l }));

  for (let i = 0; i < result.length; i++) {
    if (result[i].isDuplicate) continue;

    for (let j = i + 1; j < result.length; j++) {
      if (result[j].isDuplicate) continue;
      if (isSameVariationFamily(result[i], result[j])) continue;

      const similarity = jaccardSimilarity(
        result[i].title,
        result[j].title
      );

      const isExactMatch =
        normalizeTitle(result[i].title) ===
        normalizeTitle(result[j].title);

      if (isExactMatch || similarity >= DUPLICATE_THRESHOLD) {
        // Hard duplicate — definitely the same product
        result[j].isDuplicate = true;
        result[j].duplicateOf = result[i].sku;
        result[j].similarityScore = Math.round(similarity * 100);
        // Clear any earlier "possible duplicate" verdict instead
        // of just flipping the flag — otherwise possibleDuplicateOf
        // keeps pointing at a stale SKU while the score above now
        // reflects this newer, stronger match.
        result[j].possibleDuplicate = false;
        result[j].possibleDuplicateOf = null;
        if (result[j].complianceRisk !== "high") {
          result[j].complianceRisk = "high";
        }
        } else if (similarity >= POSSIBLE_DUPLICATE_THRESHOLD) {
        if (!result[j].possibleDuplicate) {
            result[j].possibleDuplicate = true;
            result[j].possibleDuplicateOf = result[i].sku;
            result[j].similarityScore = Math.round(
            similarity * 100
            );
            if (result[j].complianceRisk === "low") {
            result[j].complianceRisk = "medium";
            }
         }
        }
    }
  }

  return result;
}

// ─── Exact SKU collisions ────────────────────────────────────
// Two rows sharing the literal same SKU is a hard, unambiguous
// data error — not a judgment call like title similarity. Most
// marketplaces will silently overwrite one listing with the
// other on upload, so this always forces high risk.
export function detectSkuCollisions(
  listings: AuditedListing[]
): AuditedListing[] {
  const bySku = new Map<string, number>();
  for (const l of listings) {
    if (!l.sku) continue;
    bySku.set(l.sku, (bySku.get(l.sku) ?? 0) + 1);
  }

  return listings.map((l) => {
    const collision = !!l.sku && (bySku.get(l.sku) ?? 0) > 1;
    if (!collision) return l;
    return {
      ...l,
      skuCollision: true,
      complianceRisk: "high",
    };
  });
}

// ─── Variation-parent pricing ────────────────────────────────
// A row that other rows point to via parentSku is a variation
// "parent" — a grouping record, not a sellable item. Amazon's own
// spec leaves price/quantity blank on parent rows by design, so
// flagging that as "missing price" is a false positive. This only
// fires when the file actually has parent/child data; a file with
// no parentSku column leaves every row untouched.
export function reconcileVariationParentPricing(
  listings: AuditedListing[]
): AuditedListing[] {
  const parentSkus = getParentSkus(listings);
  if (parentSkus.size === 0) return listings;

  return listings.map((l) => {
    if (!parentSkus.has(l.sku)) return l;
    if (!l.missingFields.includes("price")) return l;

    const missingFields = l.missingFields.filter(
      (f) => f !== "price"
    );
    const complianceRisk =
      missingFields.length === 0 ? "low"
      : missingFields.length <= 2 ? "medium"
      : "high";

    return { ...l, missingFields, complianceRisk };
  });
}

// ─── Summary counts ──────────────────────────────────────────
export function countDuplicates(
  listings: AuditedListing[]
): number {
  return listings.filter((l) => l.isDuplicate).length;
}

export function countPossibleDuplicates(
  listings: AuditedListing[]
): number {
  return listings.filter(
    (l) => l.possibleDuplicate && !l.isDuplicate
  ).length;
}

export function countSkuCollisions(
  listings: AuditedListing[]
): number {
  return listings.filter((l) => l.skuCollision).length;
}