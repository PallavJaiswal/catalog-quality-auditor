import * as XLSX from "xlsx";
import type { AuditResult } from "./types";

export function exportAuditToExcel(result: AuditResult) {
  const workbook = XLSX.utils.book_new();

  // ── Tab 1: Summary ───────────────────────────────────────
  const summaryData = [
    ["Catalog Quality Audit Report"],
    [""],
    ["File",            result.filename],
    ["Audited At",      new Date(result.uploadedAt)
                          .toLocaleString()],
    [""],
    ["SUMMARY"],
    ["Total Listings",  result.totalListings],
    ["With Issues",     result.missingFieldsCount],
    ["Duplicates",      result.duplicatesCount],
    ["High Risk",       result.highRiskCount],
    ["Avg SEO Score",   result.averageSeoScore ?? "N/A"],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet,
    "Summary");

  // ── Tab 2: Fix List (priority sorted) ───────────────────
  const riskOrder: Record<string, number> = {
    high: 0, medium: 1, low: 2,
  };

  const sorted = [...result.listings].sort((a, b) => {
    const riskDiff =
      riskOrder[a.complianceRisk] -
      riskOrder[b.complianceRisk];
    if (riskDiff !== 0) return riskDiff;
    return b.missingFields.length - a.missingFields.length;
  });

  const fixListRows = sorted.map((l) => ({
    SKU:              l.sku,
    Title:            l.title,
    Category:         l.category,
    Brand:            l.brand,
    "SEO Score":      l.seoScore ?? "",
    "Risk Level":     l.complianceRisk,
    "Issues Found":   l.missingFields.join(", ") || "None",
    "Is Duplicate":   l.isDuplicate ? "Yes" : "No",
    "Duplicate Of":   l.duplicateOf ?? "",
    "Possible Dup":   l.possibleDuplicate ? "Yes" : "No",
    "Similar To":     l.possibleDuplicateOf ?? "",
    "Similarity %":   l.similarityScore ?? "",
    "Image Count":    l.imageCount,
    "Price":          l.price,
  }));

  const fixListSheet = XLSX.utils.json_to_sheet(fixListRows);
  fixListSheet["!cols"] = [
    { wch: 12 }, // SKU
    { wch: 50 }, // Title
    { wch: 16 }, // Category
    { wch: 16 }, // Brand
    { wch: 10 }, // SEO Score
    { wch: 10 }, // Risk
    { wch: 40 }, // Issues
    { wch: 12 }, // Is Duplicate
    { wch: 12 }, // Duplicate Of
    { wch: 12 }, // Possible Dup
    { wch: 12 }, // Similar To
    { wch: 12 }, // Similarity %
    { wch: 12 }, // Image Count
    { wch: 10 }, // Price
  ];
  XLSX.utils.book_append_sheet(workbook, fixListSheet,
    "Fix List");

  // ── Tab 3: High Risk Only ────────────────────────────────
  const highRisk = fixListRows.filter(
    (r) => r["Risk Level"] === "high"
  );
  if (highRisk.length > 0) {
    const highRiskSheet = XLSX.utils.json_to_sheet(highRisk);
    highRiskSheet["!cols"] = fixListSheet["!cols"];
    XLSX.utils.book_append_sheet(workbook, highRiskSheet,
      "High Risk");
  }

  // ── Tab 4: Duplicates ────────────────────────────────────
  const duplicates = fixListRows.filter(
    (r) =>
      r["Is Duplicate"] === "Yes" ||
      r["Possible Dup"] === "Yes"
  );
  if (duplicates.length > 0) {
    const dupSheet = XLSX.utils.json_to_sheet(duplicates);
    dupSheet["!cols"] = fixListSheet["!cols"];
    XLSX.utils.book_append_sheet(workbook, dupSheet,
      "Duplicates");
  }

  // ── Download ─────────────────────────────────────────────
  const dateStr = new Date()
    .toISOString()
    .slice(0, 10);
  const filename =
    `catalog-audit-${result.filename}-${dateStr}.xlsx`
    .replace(/[^a-z0-9.\-_]/gi, "-");

  XLSX.writeFile(workbook, filename);
}