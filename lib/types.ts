// The shape of one raw row from the uploaded file.
// Everything is a string because that's how files come in —
// numbers, booleans, everything arrives as text first.
export interface RawCatalogRow {
  sku: string;
  title: string;
  bullets: string;
  description: string;
  category: string;
  brand: string;
  image_count: string;
  price: string;
  // SKU of this listing's parent, when the file uses a
  // parent/child variation model (e.g. Amazon's parent_sku,
  // relationship_type columns). Absent/empty if the file has
  // no such concept — every marketplace-agnostic check keeps
  // working exactly as before in that case.
  parent_sku?: string;
  // A link to the product's page on the manufacturer's site (or any
  // other source page) — optional. When present, it powers
  // "Generate from Link": fetching that page and having AI write a
  // title/bullets/description grounded in it.
  product_url?: string;
}

// One phrase an AI compliance scan flagged as a policy risk —
// prohibited/unsubstantiated claims, restricted language, etc.
export interface PolicyRiskFlag {
  phrase: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface PolicyRiskResult {
  flags: PolicyRiskFlag[];
  scannedAt: string;
}

// AI's read on a "possible duplicate" (the fuzzy 50-80% similarity
// band, where a plain percentage isn't enough to act on).
export interface DuplicateVerdictResult {
  verdict: "same-listing" | "likely-variant" | "different-product";
  reason: string;
}

// The shape of one listing after we have processed it.
// Now we have typed fields and our audit results attached.
export interface AuditedListing {
  // Stable per-row identity — independent of SKU, since two rows
  // sharing the same SKU (skuCollision) is itself something this
  // tool detects and must still be able to address individually.
  id: string;

  // Original fields
  sku: string;
  title: string;
  bullets: string;
  description: string;
  category: string;
  brand: string;
  imageCount: number;       // converted from string to number
  price: number;            // converted from string to number
  parentSku: string;        // "" if the file has no parent/child model
  productUrl: string;       // "" if the file has no source-page link

  // Audit results we will calculate
  missingFields: string[];  // e.g. ["bullets", "images"]
  isDuplicate: boolean;
  duplicateOf: string | null; // sku of the original listing
  possibleDuplicate: boolean;
  possibleDuplicateOf: string | null;
  similarityScore: number | null;
  // Two or more rows share the exact same SKU — a deterministic
  // data error (a marketplace upload will silently overwrite one
  // of them), distinct from the fuzzy title-similarity check above.
  skuCollision: boolean;
  seoScore: number | null;    // 0-100, null until AI scores it
  complianceRisk: "low" | "medium" | "high";

  // AI generated content — null until the visitor requests it
  aiRewriteTitle: string | null;
  aiRewriteBullets: string | null;
  aiRewriteDescription: string | null;
  policyRisk: PolicyRiskResult | null;
  duplicateVerdict: DuplicateVerdictResult | null;
}

// The shape of the complete audit result
export interface AuditResult {
  uploadedAt: string;
  filename: string;
  totalListings: number;
  listings: AuditedListing[];

  // Summary counts for the dashboard KPI cards
  missingFieldsCount: number;
  duplicatesCount: number;
  highRiskCount: number;
  averageSeoScore: number | null;
}

// The column mapping — connects user's file headers
// to our expected field names.
// bullets and images support multiple columns
// because real catalog files often split these across columns.
export interface ColumnMapping {
  sku: string;
  title: string;
  bullets: string[];      // array — can map multiple columns
  description: string;
  category: string;
  brand: string;
  image_count: string[];  // array — can map multiple columns
  price: string;
  parent_sku: string;     // optional — blank if the file has none
  product_url: string;    // optional — blank if the file has none
}