"use client";

import { useEffect, useRef, useState } from "react";
import type { AuditedListing, PolicyRiskFlag } from "@/lib/types";
import { useAppData } from "@/lib/store";

interface ComplianceModalProps {
  listing: AuditedListing;
  onClose: () => void;
}

const SEVERITY_COLOR: Record<
  PolicyRiskFlag["severity"],
  string
> = {
  high: "var(--negative)",
  medium: "var(--warning)",
  low: "var(--text-muted)",
};

export function ComplianceModal({
  listing,
  onClose,
}: ComplianceModalProps) {
  const { updateListing } = useAppData();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState<PolicyRiskFlag[] | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  // See RewriteModal for why this is a generation counter, not a
  // mounted/unmounted boolean: StrictMode's dev-mode double-mount
  // would otherwise let a stale request's result land after the
  // fresh one, double-spending the AI budget for one click.
  const requestIdRef = useRef(0);

  async function scan() {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: listing.title,
          bullets: listing.bullets,
          description: listing.description,
          category: listing.category,
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        if (requestIdRef.current === requestId) setLimitReached(true);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      if (requestIdRef.current === requestId) {
        setFlags(data.flags);
        updateListing(listing.id, {
          policyRisk: {
            flags: data.flags,
            scannedAt: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong scanning this listing."
        );
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    // scan() fetches from the AI route; the setState calls it makes
    // all happen after that await, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);

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
            <h3 className="section-title text-text-primary">
              Compliance / Policy Risk Scan
            </h3>
            <p className="text-text-muted text-xs mt-0.5 font-mono">
              {listing.sku}
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
              Scanning for policy risk…
            </p>
          )}

          {!limitReached && error && (
            <div>
              <p className="text-sm" style={{ color: "var(--negative)" }}>
                {error}
              </p>
              <button
                onClick={scan}
                className="mt-3 text-xs px-3 py-1.5 rounded-lg
                  border border-hairline text-text-primary
                  hover:border-accent hover:text-accent"
              >
                Try Again
              </button>
            </div>
          )}

          {!limitReached && !loading && !error && flags && (
            <div className="flex flex-col gap-4">
              {flags.length === 0 ? (
                <p
                  className="text-sm"
                  style={{ color: "var(--positive)" }}
                >
                  ✓ No policy risks found in the title, bullets, or
                  description.
                </p>
              ) : (
                flags.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-2.5"
                    style={{ backgroundColor: "var(--panel-raised)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5
                          rounded-full font-medium capitalize"
                        style={{
                          backgroundColor: `${SEVERITY_COLOR[f.severity]}22`,
                          color: SEVERITY_COLOR[f.severity],
                        }}
                      >
                        {f.severity}
                      </span>
                      <span className="text-sm text-text-primary font-medium">
                        &ldquo;{f.phrase}&rdquo;
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-1.5">
                      {f.reason}
                    </p>
                  </div>
                ))
              )}

              <p
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                AI-generated, not legal advice — use this as a first
                pass, then confirm anything high-severity against the
                marketplace&apos;s actual policy before editing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
