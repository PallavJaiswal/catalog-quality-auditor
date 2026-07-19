"use client";

import { useMemo, useState } from "react";
import type { AuditedListing } from "@/lib/types";
import { RewriteModal } from "@/components/RewriteModal";
import { ComplianceModal } from "@/components/ComplianceModal";
import { DuplicateVerdictButton } from "@/components/DuplicateVerdictButton";
import { GenerateFromLinkModal } from "@/components/GenerateFromLinkModal";

interface FixListTableProps {
  listings: AuditedListing[];
}

// Listings scoring below this don't need a rewrite suggestion —
// keeps API calls limited to listings that actually need help.
const REWRITE_SCORE_THRESHOLD = 70;

type RiskFilter = "all" | "high" | "medium" | "low";
type SortColumn = "sku" | "title" | "seoScore" | "risk";

export function FixListTable({ listings }: FixListTableProps) {
  const [filter, setFilter] = useState<RiskFilter>("all");
  const [search, setSearch] = useState<string>("");
  const [sortColumn, setSortColumn] =
    useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");
  const [rewriteTarget, setRewriteTarget] =
    useState<AuditedListing | null>(null);
  const [linkTarget, setLinkTarget] =
    useState<AuditedListing | null>(null);
  const [complianceTarget, setComplianceTarget] =
    useState<AuditedListing | null>(null);

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  const sorted = useMemo(() => {
    const riskOrder: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return listings
      .filter((l) => {
        if (filter !== "all" && l.complianceRisk !== filter)
          return false;
        if (
          search &&
          !l.sku.toLowerCase().includes(search.toLowerCase()) &&
          !l.title.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        if (sortColumn) {
          let result = 0;

          if (sortColumn === "sku") {
            result = a.sku.localeCompare(b.sku);
          } else if (sortColumn === "title") {
            result = a.title.localeCompare(b.title);
          } else if (sortColumn === "seoScore") {
            result = (a.seoScore ?? 0) - (b.seoScore ?? 0);
          } else if (sortColumn === "risk") {
            result =
              riskOrder[a.complianceRisk] -
              riskOrder[b.complianceRisk];
          }

          return sortDirection === "asc" ? result : -result;
        }

        const riskDiff =
          riskOrder[a.complianceRisk] -
          riskOrder[b.complianceRisk];
        if (riskDiff !== 0) return riskDiff;
        return b.missingFields.length - a.missingFields.length;
      });
  }, [listings, filter, search, sortColumn, sortDirection]);

  return (
    <div
      className="rounded-xl border border-hairline overflow-hidden"
      style={{ backgroundColor: "var(--panel)" }}
    >
      {/* Table header */}
      <div
        className="px-5 py-4 border-b border-hairline
          flex flex-col sm:flex-row sm:items-center
          justify-between gap-3"
      >
        <div>
          <h2 className="section-title text-text-primary">
            Fix List
          </h2>
          <p className="text-text-muted text-xs mt-0.5">
            {sorted.length} listings · click any column to sort
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search SKU or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg
              border border-hairline bg-panel-raised
              text-text-primary placeholder:text-text-muted
              focus:outline-none focus:border-accent w-48"
          />

          {(["all", "high", "medium", "low"] as RiskFilter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs
                  font-medium transition-colors capitalize"
                style={{
                  backgroundColor:
                    filter === f
                      ? "var(--accent)"
                      : "var(--panel-raised)",
                  color:
                    filter === f
                      ? "var(--ink)"
                      : "var(--text-muted)",
                }}
              >
                {f}
              </button>
            )
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b border-hairline"
              style={{ backgroundColor: "var(--panel-raised)" }}
            >
              <SortableHeader
                label="SKU"
                column="sku"
                currentSort={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Title"
                column="title"
                currentSort={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              />
              <th
                className="px-4 py-3 text-left mono-label
                  text-text-muted whitespace-nowrap"
              >
                Issues
              </th>
              <SortableHeader
                label="SEO Score"
                column="seoScore"
                currentSort={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Risk"
                column="risk"
                currentSort={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              />
              <th
                className="px-4 py-3 text-left mono-label
                  text-text-muted whitespace-nowrap"
              >
                Duplicate
              </th>
              <th
                className="px-4 py-3 text-left mono-label
                  text-text-muted whitespace-nowrap"
              >
                Rewrite
              </th>
              <th
                className="px-4 py-3 text-left mono-label
                  text-text-muted whitespace-nowrap"
              >
                Policy
              </th>
              <th
                className="px-4 py-3 text-left mono-label
                  text-text-muted whitespace-nowrap"
              >
                Source Link
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((listing) => (
              <tr
                key={listing.id}
                className="border-b border-hairline
                  hover:bg-panel-raised transition-colors"
              >
                {/* SKU */}
                <td className="px-4 py-3 font-mono text-xs
                  text-text-primary whitespace-nowrap">
                  {listing.sku}
                </td>

                {/* Title */}
                <td className="px-4 py-3 text-text-muted
                  max-w-xs">
                  <span
                    className="block truncate"
                    title={listing.title}
                  >
                    {listing.title || (
                      <span
                        style={{ color: "var(--negative)" }}
                      >
                        No title
                      </span>
                    )}
                  </span>
                </td>

                {/* Issues */}
                <td className="px-4 py-3">
                  {listing.missingFields.length === 0 ? (
                    <span
                      className="text-xs"
                      style={{ color: "var(--positive)" }}
                    >
                      ✓ No issues
                    </span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {listing.missingFields.map((f, j) => (
                        <span
                          key={j}
                          className="text-xs px-2 py-0.5
                            rounded-full whitespace-nowrap w-fit"
                          style={{
                            backgroundColor:
                              "rgba(248,81,73,0.1)",
                            color: "var(--negative)",
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </td>

                {/* SEO Score */}
                <td className="px-4 py-3">
                  {listing.seoScore !== null ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-16 h-1.5 rounded-full
                          overflow-hidden"
                        style={{
                          backgroundColor:
                            "var(--panel-raised)",
                        }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${listing.seoScore}%`,
                            backgroundColor:
                              listing.seoScore >= 70
                                ? "var(--positive)"
                                : listing.seoScore >= 40
                                ? "var(--warning)"
                                : "var(--negative)",
                          }}
                        />
                      </div>
                      <span
                        className="stat-value text-xs font-mono"
                        style={{
                          color:
                            listing.seoScore >= 70
                              ? "var(--positive)"
                              : listing.seoScore >= 40
                              ? "var(--warning)"
                              : "var(--negative)",
                        }}
                      >
                        {listing.seoScore}
                      </span>
                    </div>
                  ) : (
                    <span className="text-text-muted text-xs">
                      —
                    </span>
                  )}
                </td>

                {/* Risk badge */}
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 rounded-full
                      text-xs font-medium capitalize"
                    style={{
                      backgroundColor:
                        listing.complianceRisk === "high"
                          ? "rgba(248,81,73,0.15)"
                          : listing.complianceRisk === "medium"
                          ? "rgba(227,179,65,0.15)"
                          : "rgba(52,194,154,0.15)",
                      color:
                        listing.complianceRisk === "high"
                          ? "var(--negative)"
                          : listing.complianceRisk === "medium"
                          ? "var(--warning)"
                          : "var(--positive)",
                    }}
                  >
                    {listing.complianceRisk}
                  </span>
                </td>

                {/* Duplicate */}
                <td className="px-4 py-3">
                  {listing.skuCollision ? (
                    <div>
                      <span
                        className="text-xs px-2 py-0.5
                          rounded-full font-medium"
                        style={{
                          backgroundColor:
                            "rgba(248,81,73,0.18)",
                          color: "var(--negative)",
                        }}
                      >
                        ⛔ Duplicate SKU
                      </span>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Another row reuses this exact SKU —
                        the marketplace will silently overwrite
                        one of them.
                      </p>
                    </div>
                  ) : listing.isDuplicate ? (
                    <div>
                      <span
                        className="text-xs px-2 py-0.5
                          rounded-full"
                        style={{
                          backgroundColor:
                            "rgba(248,81,73,0.1)",
                          color: "var(--negative)",
                        }}
                      >
                        Duplicate
                      </span>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        of {listing.duplicateOf}
                      </p>
                      {listing.similarityScore !== null && (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {listing.similarityScore}% match
                        </p>
                      )}
                    </div>
                  ) : listing.possibleDuplicate ? (
                    <div>
                      <span
                        className="text-xs px-2 py-0.5
                          rounded-full"
                        style={{
                          backgroundColor:
                            "rgba(227,179,65,0.15)",
                          color: "var(--warning)",
                        }}
                      >
                        ⚠ Possible duplicate
                      </span>
                      {listing.possibleDuplicateOf && (
                        <p
                          className="text-xs mt-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          of {listing.possibleDuplicateOf}
                        </p>
                      )}
                      {listing.similarityScore !== null && (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {listing.similarityScore}% similar
                        </p>
                      )}
                      <DuplicateVerdictButton
                        listing={listing}
                        comparedTo={listings.find(
                          (l) => l.sku === listing.possibleDuplicateOf
                        )}
                      />
                    </div>
                  ) : (
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      —
                    </span>
                  )}
                </td>

                {/* Rewrite */}
                <td className="px-4 py-3">
                  {listing.seoScore === null ||
                  listing.seoScore < REWRITE_SCORE_THRESHOLD ? (
                    <button
                      onClick={() => setRewriteTarget(listing)}
                      className="text-xs px-3 py-1.5 rounded-lg
                        border border-hairline whitespace-nowrap
                        text-text-primary hover:border-accent
                        hover:text-accent transition-colors"
                    >
                      ✨ Suggest Rewrite
                    </button>
                  ) : (
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      —
                    </span>
                  )}
                </td>

                {/* Policy */}
                <td className="px-4 py-3">
                  {listing.policyRisk ? (
                    listing.policyRisk.flags.length === 0 ? (
                      <span
                        className="text-xs"
                        style={{ color: "var(--positive)" }}
                      >
                        ✓ Clean
                      </span>
                    ) : (
                      <button
                        onClick={() => setComplianceTarget(listing)}
                        className="text-xs px-2 py-0.5 rounded-full
                          font-medium"
                        style={{
                          backgroundColor:
                            listing.policyRisk.flags.some(
                              (f) => f.severity === "high"
                            )
                              ? "rgba(248,81,73,0.18)"
                              : "rgba(227,179,65,0.15)",
                          color: listing.policyRisk.flags.some(
                            (f) => f.severity === "high"
                          )
                            ? "var(--negative)"
                            : "var(--warning)",
                        }}
                      >
                        ⚠ {listing.policyRisk.flags.length} risk
                        {listing.policyRisk.flags.length > 1 ? "s" : ""}
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => setComplianceTarget(listing)}
                      className="text-xs px-3 py-1.5 rounded-lg
                        border border-hairline whitespace-nowrap
                        text-text-primary hover:border-accent
                        hover:text-accent transition-colors"
                    >
                      🛡 Scan
                    </button>
                  )}
                </td>

                {/* Source Link */}
                <td className="px-4 py-3">
                  {listing.productUrl ? (
                    <button
                      onClick={() => setLinkTarget(listing)}
                      className="text-xs px-3 py-1.5 rounded-lg
                        border border-hairline whitespace-nowrap
                        text-text-primary hover:border-accent
                        hover:text-accent transition-colors"
                    >
                      🔗 Generate
                    </button>
                  ) : (
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center
                    text-text-muted text-sm"
                >
                  No listings match your current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rewriteTarget && (
        <RewriteModal
          listing={rewriteTarget}
          onClose={() => setRewriteTarget(null)}
        />
      )}

      {complianceTarget && (
        <ComplianceModal
          listing={complianceTarget}
          onClose={() => setComplianceTarget(null)}
        />
      )}

      {linkTarget && (
        <GenerateFromLinkModal
          listing={linkTarget}
          onClose={() => setLinkTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Sortable column header ─────────────────────────────────
interface SortableHeaderProps {
  label: string;
  column: SortColumn;
  currentSort: SortColumn | null;
  direction: "asc" | "desc";
  onSort: (column: SortColumn) => void;
}

function SortableHeader({
  label,
  column,
  currentSort,
  direction,
  onSort,
}: SortableHeaderProps) {
  const isActive = currentSort === column;

  return (
    <th
      onClick={() => onSort(column)}
      className="px-4 py-3 text-left mono-label
        text-text-muted whitespace-nowrap cursor-pointer
        select-none hover:text-text-primary
        transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span
          style={{
            color: isActive
              ? "var(--accent)"
              : "var(--text-muted)",
            opacity: isActive ? 1 : 0.4,
          }}
        >
          {isActive && direction === "asc" ? "↑" : "↓"}
        </span>
      </span>
    </th>
  );
}