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
}

// The shape of one listing after we have processed it.
// Now we have typed fields and our audit results attached.
export interface AuditedListing {
  // Original fields
  sku: string;
  title: string;
  bullets: string;
  description: string;
  category: string;
  brand: string;
  imageCount: number;       // converted from string to number
  price: number;            // converted from string to number

  // Audit results we will calculate
  missingFields: string[];  // e.g. ["bullets", "images"]
  isDuplicate: boolean;
  duplicateOf: string | null; // sku of the original listing
  possibleDuplicate: boolean;
  possibleDuplicateOf: string | null;
  similarityScore: number | null;
  seoScore: number | null;    // 0-100, null until AI scores it
  complianceRisk: "low" | "medium" | "high";

  // AI generated content (added later)
  aiRewriteTitle: string | null;
  aiRewriteBullets: string | null;
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
}