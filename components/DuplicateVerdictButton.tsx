"use client";

import { useState } from "react";
import type { AuditedListing, DuplicateVerdictResult } from "@/lib/types";
import { useAppData } from "@/lib/store";
import {
  hasAiActionsRemaining,
  recordAiAction,
} from "@/lib/aiUsage";

interface DuplicateVerdictButtonProps {
  listing: AuditedListing;
  comparedTo: AuditedListing | undefined;
}

const VERDICT_LABEL: Record<DuplicateVerdictResult["verdict"], string> = {
  "same-listing": "Same listing — likely a true duplicate",
  "likely-variant": "Likely a legitimate variant, not a duplicate",
  "different-product": "Different product — not a duplicate",
};

const VERDICT_COLOR: Record<DuplicateVerdictResult["verdict"], string> = {
  "same-listing": "var(--negative)",
  "likely-variant": "var(--positive)",
  "different-product": "var(--positive)",
};

export function DuplicateVerdictButton({
  listing,
  comparedTo,
}: DuplicateVerdictButtonProps) {
  const { updateListing } = useAppData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  async function askAi() {
    if (!comparedTo) return;
    if (!hasAiActionsRemaining()) {
      setLimitReached(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/duplicate-verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          a: {
            sku: listing.sku,
            title: listing.title,
            bullets: listing.bullets,
            description: listing.description,
          },
          b: {
            sku: comparedTo.sku,
            title: comparedTo.title,
            bullets: comparedTo.bullets,
            description: comparedTo.description,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      recordAiAction();
      updateListing(listing.id, {
        duplicateVerdict: {
          verdict: data.verdict,
          reason: data.reason,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong comparing these listings."
      );
    } finally {
      setLoading(false);
    }
  }

  if (listing.duplicateVerdict) {
    const v = listing.duplicateVerdict;
    return (
      <div className="mt-1">
        <p
          className="text-xs font-medium"
          style={{ color: VERDICT_COLOR[v.verdict] }}
        >
          🤖 {VERDICT_LABEL[v.verdict]}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {v.reason}
        </p>
      </div>
    );
  }

  if (limitReached) {
    return (
      <p className="text-xs mt-1" style={{ color: "var(--warning)" }}>
        Demo AI limit reached.
      </p>
    );
  }

  if (error) {
    return (
      <button
        onClick={askAi}
        className="text-xs mt-1"
        style={{ color: "var(--negative)" }}
      >
        {error} Retry?
      </button>
    );
  }

  if (!comparedTo) return null;

  return (
    <button
      onClick={askAi}
      disabled={loading}
      className="text-xs mt-1 px-2 py-0.5 rounded-md border
        border-hairline text-text-muted hover:border-accent
        hover:text-accent transition-colors disabled:opacity-50"
    >
      {loading ? "Asking AI…" : "🤖 Ask AI to verify"}
    </button>
  );
}
