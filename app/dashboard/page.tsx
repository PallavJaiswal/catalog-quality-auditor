"use client";

import { exportAuditToExcel } from "@/lib/exportExcel";
import { exportAuditToPdf } from "@/lib/exportPdf";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/lib/store";
import { KpiCard } from "@/components/KpiCard";
import { FixListTable } from "@/components/FixListTable";

export default function DashboardPage() {
  const router = useRouter();
  const { auditResult } = useAppData();

  // If no audit result exists, send back to upload
  useEffect(() => {
    if (!auditResult) {
      router.push("/upload");
    }
  }, [auditResult, router]);

  if (!auditResult) return null;

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">

        {/* Page header */}
        <div className="mb-8 flex items-start justify-between
        gap-4 flex-wrap">
        <div>
            <p className="mono-label text-accent mb-1">
            Audit Complete
            </p>
            <h1 className="text-xl font-semibold text-text-primary">
            {auditResult.filename}
            </h1>
            <p className="text-text-muted text-sm mt-1">
            Processed {auditResult.totalListings} listings ·{" "}
            {new Date(auditResult.uploadedAt).toLocaleString()}
            </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-3">
          <button
              onClick={() => exportAuditToExcel(auditResult)}
              className="flex items-center gap-2 px-4 py-2
              rounded-lg border border-hairline text-sm
              font-medium text-text-primary
              hover:border-accent hover:text-accent
              transition-colors"
          >
              <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16" height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              >
              <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25
                  2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5
                  12m4.5 4.5V3"
              />
              </svg>
              Export to Excel
          </button>

          <button
              onClick={() => exportAuditToPdf(auditResult)}
              className="flex items-center gap-2 px-4 py-2
              rounded-lg border border-hairline text-sm
              font-medium text-text-primary
              hover:border-accent hover:text-accent
              transition-colors"
          >
              <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16" height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              >
              <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0
                  012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1
                  0 01.293.707V19a2 2 0 01-2 2z"
              />
              </svg>
              Export to PDF
          </button>
        </div>
        </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Listings"
          value={String(auditResult.totalListings)}
          accent="default"
        />
        <KpiCard
          label="With Issues"
          value={String(auditResult.missingFieldsCount)}
          accent={
            auditResult.missingFieldsCount > 0
              ? "warning"
              : "positive"
          }
        />
        <KpiCard
          label="Duplicates Found"
          value={String(auditResult.duplicatesCount)}
          accent={
            auditResult.duplicatesCount > 0
              ? "negative"
              : "positive"
          }
        />
        <KpiCard
          label="Avg SEO Score"
          value={
            auditResult.averageSeoScore !== null
              ? `${auditResult.averageSeoScore}/100`
              : "—"
          }
          accent={
            auditResult.averageSeoScore !== null &&
            auditResult.averageSeoScore >= 70
              ? "positive"
              : "warning"
          }
        />
      </div>

      {/* Fix list table */}
      <FixListTable listings={auditResult.listings} />

    </div>
  );
}