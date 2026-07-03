import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AuditedListing, AuditResult } from "./types";

// Shared navy color for table headers — matches the dashboard's
// dark navy theme so the PDF feels like part of the same product.
const HEADER_COLOR: [number, number, number] = [15, 42, 66];
const MARGIN_X = 40;

// Turns one AuditedListing into a single table row for the PDF.
// Kept separate from the Excel row-mapper because the PDF shows
// fewer, more essential columns (see note above).
function toPdfRow(l: AuditedListing): (string | number)[] {
  let duplicateInfo = "—";
  if (l.isDuplicate) {
    duplicateInfo = `Duplicate of ${l.duplicateOf}`;
  } else if (l.possibleDuplicate) {
    duplicateInfo =
      `Possible dup of ${l.possibleDuplicateOf} ` +
      `(${l.similarityScore}%)`;
  }

  return [
    l.sku,
    l.title,
    l.seoScore ?? "",
    l.complianceRisk,
    l.missingFields.join(", ") || "None",
    duplicateInfo,
  ];
}

// Draws one table section on its own page: a bold section title,
// then an autoTable below it. Pulled into a helper so the Fix List,
// High Risk, and Duplicates sections don't each repeat the same
// table-styling code three times.
function addTableSection(
  doc: jsPDF,
  title: string,
  rows: (string | number)[][]
) {
  doc.addPage();
  const startY = 50;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN_X, startY);

  autoTable(doc, {
    startY: startY + 12,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: {
      1: { cellWidth: 190 }, // Title
      5: { cellWidth: 170 }, // Duplicate Info
    },
    head: [
      ["SKU", "Title", "SEO Score", "Risk", "Issues Found",
        "Duplicate Info"],
    ],
    body: rows,
    margin: { left: MARGIN_X, right: MARGIN_X },
    // Color the Risk column by severity — same idea as the
    // colored risk badges on the dashboard.
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const risk = String(data.cell.raw).toLowerCase();
        if (risk === "high") {
          data.cell.styles.textColor = [200, 40, 40];
        } else if (risk === "medium") {
          data.cell.styles.textColor = [200, 140, 20];
        } else {
          data.cell.styles.textColor = [40, 140, 90];
        }
      }
    },
  });
}

export function exportAuditToPdf(result: AuditResult) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  // ── Page 1: Title + Summary ──────────────────────────────
  let cursorY = 50;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Catalog Quality Audit Report", MARGIN_X, cursorY);

  cursorY += 24;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`File: ${result.filename}`, MARGIN_X, cursorY);
  cursorY += 14;
  doc.text(
    `Audited At: ${new Date(result.uploadedAt).toLocaleString()}`,
    MARGIN_X,
    cursorY
  );

  cursorY += 28;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", MARGIN_X, cursorY);

  autoTable(doc, {
    startY: cursorY + 10,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: HEADER_COLOR },
    head: [[
      "Total Listings", "With Issues", "Duplicates",
      "High Risk", "Avg SEO Score",
    ]],
    body: [[
      result.totalListings,
      result.missingFieldsCount,
      result.duplicatesCount,
      result.highRiskCount,
      result.averageSeoScore ?? "N/A",
    ]],
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  // ── Fix List (priority sorted — same logic as Excel export) ─
  const riskOrder: Record<string, number> = {
    high: 0, medium: 1, low: 2,
  };
  const sorted = [...result.listings].sort((a, b) => {
    const riskDiff =
      riskOrder[a.complianceRisk] - riskOrder[b.complianceRisk];
    if (riskDiff !== 0) return riskDiff;
    return b.missingFields.length - a.missingFields.length;
  });

  addTableSection(doc, "Fix List (Priority Order)",
    sorted.map(toPdfRow));

  // ── High Risk Only ────────────────────────────────────────
  const highRisk = sorted.filter((l) => l.complianceRisk === "high");
  if (highRisk.length > 0) {
    addTableSection(doc, "High Risk Listings",
      highRisk.map(toPdfRow));
  }

  // ── Duplicates Only ───────────────────────────────────────
  const duplicates = sorted.filter(
    (l) => l.isDuplicate || l.possibleDuplicate
  );
  if (duplicates.length > 0) {
    addTableSection(doc, "Duplicates", duplicates.map(toPdfRow));
  }

  // ── Download ──────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename =
    `catalog-audit-${result.filename}-${dateStr}.pdf`
      .replace(/[^a-z0-9.\-_]/gi, "-");

  doc.save(filename);
}
