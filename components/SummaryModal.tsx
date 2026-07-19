"use client";

import { useEffect, useRef, useState } from "react";
import type { AuditResult } from "@/lib/types";
import {
  hasAiActionsRemaining,
  recordAiAction,
} from "@/lib/aiUsage";

interface SummaryModalProps {
  auditResult: AuditResult;
  onClose: () => void;
}

// Missing-field entries carry a parenthetical detail that's unique
// per listing (e.g. "title too short (35 chars, min 40)") — strip it
// so counts actually bucket by issue type instead of fragmenting
// into one bucket per listing.
function normalizeIssue(issue: string): string {
  return issue.replace(/\s*\(.*\)$/, "");
}

export function SummaryModal({
  auditResult,
  onClose,
}: SummaryModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  // See RewriteModal for why this is a generation counter, not a
  // mounted/unmounted boolean: StrictMode's dev-mode double-mount
  // would otherwise let a stale request's result land after the
  // fresh one, double-spending the AI budget for one click.
  const requestIdRef = useRef(0);

  async function generate() {
    const requestId = ++requestIdRef.current;

    if (!hasAiActionsRemaining()) {
      setLimitReached(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const topIssueCounts: Record<string, number> = {};
      for (const l of auditResult.listings) {
        for (const issue of l.missingFields) {
          const key = normalizeIssue(issue);
          topIssueCounts[key] = (topIssueCounts[key] ?? 0) + 1;
        }
        if (l.skuCollision) {
          topIssueCounts["duplicate SKU"] =
            (topIssueCounts["duplicate SKU"] ?? 0) + 1;
        }
      }

      const worstListings = [...auditResult.listings]
        .sort((a, b) => {
          const riskOrder = { high: 0, medium: 1, low: 2 };
          return riskOrder[a.complianceRisk] - riskOrder[b.complianceRisk];
        })
        .slice(0, 15)
        .map((l) => ({
          sku: l.sku,
          title: l.title,
          complianceRisk: l.complianceRisk,
          missingFields: l.missingFields,
          skuCollision: l.skuCollision,
          isDuplicate: l.isDuplicate,
        }));

      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: auditResult.filename,
          totalListings: auditResult.totalListings,
          missingFieldsCount: auditResult.missingFieldsCount,
          duplicatesCount: auditResult.duplicatesCount,
          skuCollisionsCount: auditResult.listings.filter(
            (l) => l.skuCollision
          ).length,
          highRiskCount: auditResult.highRiskCount,
          averageSeoScore: auditResult.averageSeoScore,
          topIssueCounts,
          worstListings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      if (requestIdRef.current === requestId) {
        setSummary(data.summary);
        recordAiAction();
      }
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong generating the summary."
        );
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    // generate() fetches from the AI route; the setState calls it
    // makes all happen after that await, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditResult.filename]);

  function handleCopy() {
    if (summary) navigator.clipboard.writeText(summary);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center
        justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border
          border-hairline max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: "var(--panel)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b border-hairline
            flex items-center justify-between"
        >
          <div>
            <h3 className="font-semibold text-sm text-text-primary">
              AI Executive Summary
            </h3>
            <p className="text-text-muted text-xs mt-0.5 font-mono">
              {auditResult.filename}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary
              text-sm px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {limitReached && (
            <p className="text-sm" style={{ color: "var(--warning)" }}>
              This is a demo version, limited to a handful of AI
              actions per visitor — thanks for trying it out! Feel
              free to explore everything else in the tool.
            </p>
          )}

          {!limitReached && loading && (
            <p className="text-text-muted text-sm">
              Writing an executive summary…
            </p>
          )}

          {!limitReached && error && (
            <div>
              <p className="text-sm" style={{ color: "var(--negative)" }}>
                {error}
              </p>
              <button
                onClick={generate}
                className="mt-3 text-xs px-3 py-1.5 rounded-lg
                  border border-hairline text-text-primary
                  hover:border-accent hover:text-accent"
              >
                Try Again
              </button>
            </div>
          )}

          {!limitReached && !loading && !error && summary && (
            <div className="flex flex-col gap-4">
              <p
                className="text-sm whitespace-pre-line leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {summary}
              </p>
              <button
                onClick={handleCopy}
                className="self-start text-xs px-3 py-1.5 rounded-lg
                  border border-hairline text-text-primary
                  hover:border-accent hover:text-accent
                  transition-colors"
              >
                Copy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
