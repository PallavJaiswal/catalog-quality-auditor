"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuditResult } from "@/lib/types";
import { useAppData } from "@/lib/store";

export default function ReportsPage() {
  const router = useRouter();
  const { auditResult } = useAppData();
  const [history, setHistory] = useState<AuditResult[]>([]);

  // Load report history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(
        "catalog-auditor:reports"
      );
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // localStorage unavailable
    }
  }, []);

  function handleView(report: AuditResult) {
    // Coming soon — for now just note it
    alert(
      `Viewing past reports will be available in V2.\n\nFor now, re-upload the file to run a fresh audit.`
    );
  }

  function handleClearHistory() {
    localStorage.removeItem("catalog-auditor:reports");
    setHistory([]);
  }

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-8 flex items-start
        justify-between">
        <div>
          <p className="mono-label text-accent mb-1">
            Report History
          </p>
          <h1 className="page-title text-text-primary">
            Past Audits
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Saved locally in your browser · last 10 runs
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="text-xs text-text-muted
              hover:text-negative transition-colors"
          >
            Clear history
          </button>
        )}
      </div>

      {/* Empty state */}
      {history.length === 0 && (
        <div
          className="rounded-xl border border-hairline
            p-12 flex flex-col items-center gap-4
            text-center"
          style={{ backgroundColor: "var(--panel)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex
              items-center justify-center"
            style={{
              backgroundColor: "var(--panel-raised)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24" height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0
                00-3.375-3.375h-1.5A1.125 1.125 0
                0113.5 7.125v-1.5a3.375 3.375 0
                00-3.375-3.375H8.25m0 12.75h7.5m-7.5
                3H12M10.5 2.25H5.625c-.621 0-1.125
                .504-1.125 1.125v17.25c0 .621.504
                1.125 1.125 1.125h12.75c.621 0
                1.125-.504 1.125-1.125V11.25a9 9 0
                00-9-9z"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium text-sm
              text-text-primary">
              No audit reports yet
            </p>
            <p className="text-text-muted text-xs mt-1">
              Run your first audit to see reports here
            </p>
          </div>
          <button
            onClick={() => router.push("/upload")}
            className="mt-2 px-4 py-2 rounded-lg
              text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--ink)",
            }}
          >
            Upload a catalog
          </button>
        </div>
      )}

      {/* Report cards */}
      {history.length > 0 && (
        <div className="flex flex-col gap-4">
          {history.map((report, i) => (
            <div
              key={i}
              className="rounded-xl border border-hairline
                p-5 flex flex-col sm:flex-row sm:items-center
                justify-between gap-4"
              style={{ backgroundColor: "var(--panel)" }}
            >
              {/* Report info */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {i === 0 && (
                    <span
                      className="text-xs px-2 py-0.5
                        rounded-full mono-label"
                      style={{
                        backgroundColor:
                          "var(--accent-dim, #0f4f4a)",
                        color: "var(--accent)",
                      }}
                    >
                      Latest
                    </span>
                  )}
                  <p className="font-medium text-sm
                    text-text-primary">
                    {report.filename}
                  </p>
                </div>
                <p className="text-text-muted text-xs">
                  {new Date(
                    report.uploadedAt
                  ).toLocaleString()}
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="stat-value font-semibold text-sm
                    text-text-primary">
                    {report.totalListings}
                  </p>
                  <p className="mono-label text-text-muted">
                    Listings
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="stat-value font-semibold text-sm"
                    style={{
                      color:
                        report.missingFieldsCount > 0
                          ? "var(--warning)"
                          : "var(--positive)",
                    }}
                  >
                    {report.missingFieldsCount}
                  </p>
                  <p className="mono-label text-text-muted">
                    Issues
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="stat-value font-semibold text-sm"
                    style={{
                      color:
                        report.duplicatesCount > 0
                          ? "var(--negative)"
                          : "var(--positive)",
                    }}
                  >
                    {report.duplicatesCount}
                  </p>
                  <p className="mono-label text-text-muted">
                    Duplicates
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="stat-value font-semibold text-sm"
                    style={{
                      color:
                        report.averageSeoScore !== null &&
                        report.averageSeoScore >= 70
                          ? "var(--positive)"
                          : "var(--warning)",
                    }}
                  >
                    {report.averageSeoScore ?? "—"}
                  </p>
                  <p className="mono-label text-text-muted">
                    Avg Score
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleView(report)}
                  className="px-3 py-1.5 rounded-lg
                    text-xs font-medium border
                    border-hairline text-text-muted
                    hover:border-accent hover:text-accent
                    transition-colors"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* V2 note */}
      {history.length > 0 && (
        <p className="text-text-muted text-xs text-center
          mt-8">
          Reports are saved locally in this browser only ·
          Cloud storage and team sharing coming in V2
        </p>
      )}

    </div>
  );
}