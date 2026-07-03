import type { AuditedListing, RawCatalogRow } from "./types";

// ─── Thresholds ──────────────────────────────────────────────
// Defined once here so they're easy to adjust later.
// If a client wants stricter rules, change these numbers.
const MIN_TITLE_LENGTH = 40;    // characters
const MIN_BULLET_COUNT = 3;     // individual bullets
const MIN_IMAGE_COUNT  = 3;     // images
const MIN_PRICE        = 0.01;  // must have a real price

// ─── Main validation function ────────────────────────────────
// Takes one raw row, returns a fully audited listing.
export function validateListing(row: RawCatalogRow): AuditedListing {
  const missingFields: string[] = [];

  // --- SKU check ---
  if (!row.sku || row.sku.trim() === "") {
    missingFields.push("sku");
  }

  // --- Title checks ---
  if (!row.title || row.title.trim() === "") {
    missingFields.push("title");
  } else if (row.title.trim().length < MIN_TITLE_LENGTH) {
    missingFields.push(
      `title too short (${row.title.trim().length} chars, min ${MIN_TITLE_LENGTH})`
    );
  }

  // --- Bullets check ---
  // Bullets are pipe-separated: "Feature 1|Feature 2|Feature 3"
  const bulletList = row.bullets
    .split("|")
    .map((b) => b.trim())
    .filter(Boolean);

  if (bulletList.length === 0) {
    missingFields.push("bullets");
  } else if (bulletList.length < MIN_BULLET_COUNT) {
    missingFields.push(
      `too few bullets (${bulletList.length}, min ${MIN_BULLET_COUNT})`
    );
  }

  // --- Description check ---
  if (!row.description || row.description.trim() === "") {
    missingFields.push("description");
  }

  // --- Image count check ---
  const imageCount = parseInt(row.image_count ?? "0", 10);
  if (isNaN(imageCount) || imageCount < MIN_IMAGE_COUNT) {
    missingFields.push(
      `images (${imageCount} found, min ${MIN_IMAGE_COUNT})`
    );
  }

  // --- Price check ---
  const price = parseFloat(row.price ?? "0");
  if (isNaN(price) || price < MIN_PRICE) {
    missingFields.push("price");
  }

  // --- Compliance risk ---
  // Based on how many problems we found
  const complianceRisk =
    missingFields.length === 0 ? "low"
    : missingFields.length <= 2 ? "medium"
    : "high";

  return {
    // Original fields — converted to correct types
    sku:         row.sku?.trim() ?? "",
    title:       row.title?.trim() ?? "",
    bullets:     row.bullets?.trim() ?? "",
    description: row.description?.trim() ?? "",
    category:    row.category?.trim() ?? "Uncategorized",
    brand:       row.brand?.trim() ?? "Unknown",
    imageCount,
    price:       isNaN(price) ? 0 : price,

    // Audit results
    missingFields,
    complianceRisk,

    // These get filled in by later steps
    isDuplicate:       false,
    duplicateOf:       null,
    possibleDuplicate: false,
    possibleDuplicateOf: null,
    similarityScore:   null,
    seoScore:          null,
    aiRewriteTitle:    null,
    aiRewriteBullets:  null,
  };
}

// ─── Validate all listings ───────────────────────────────────
// Runs validateListing on every row and returns the results.
export function validateAllListings(
  rows: RawCatalogRow[]
): AuditedListing[] {
  return rows.map((row) => validateListing(row));
}

// ─── Summary counts ──────────────────────────────────────────
// Used by the dashboard KPI cards.
export function countValidationIssues(listings: AuditedListing[]) {
  return {
    totalListings:      listings.length,
    withMissingFields:  listings.filter(
                          (l) => l.missingFields.length > 0
                        ).length,
    highRisk:           listings.filter(
                          (l) => l.complianceRisk === "high"
                        ).length,
    mediumRisk:         listings.filter(
                          (l) => l.complianceRisk === "medium"
                        ).length,
    lowRisk:            listings.filter(
                          (l) => l.complianceRisk === "low"
                        ).length,
    missingImages:      listings.filter(
                          (l) => l.imageCount < MIN_IMAGE_COUNT
                        ).length,
    weakTitles:         listings.filter(
                          (l) => l.title.length < MIN_TITLE_LENGTH
                        ).length,
    missingBullets:     listings.filter(
                          (l) => {
                            const bullets = l.bullets
                              .split("|")
                              .filter(Boolean);
                            return bullets.length < MIN_BULLET_COUNT;
                          }
                        ).length,
  };
}