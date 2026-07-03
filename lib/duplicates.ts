import type { AuditedListing } from "./types";

// Hard duplicate threshold — definitely the same product
const DUPLICATE_THRESHOLD = 0.8;

// Soft warning threshold — possibly the same product
const POSSIBLE_DUPLICATE_THRESHOLD = 0.5;

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
        result[j].possibleDuplicate = false;
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