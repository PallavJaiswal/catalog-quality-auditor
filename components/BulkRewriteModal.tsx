"use client";

import { useState } from "react";
import Papa from "papaparse";
import type { AuditedListing } from "@/lib/types";
import { useAppData } from "@/lib/store";
import {
  getAiActionsRemaining,
  recordAiAction,
} from "@/lib/aiUsage";

interface BulkRewriteModalProps {
  candidates: AuditedListing[];
  onClose: () => void;
}

interface QueueItem {
  listing: AuditedListing;
  status: "pending" | "loading" | "done" | "error" | "skipped";
  title?: string;
  bullets?: string;
  description?: string;
  error?: string;
}

async function rewriteOne(listing: AuditedListing) {
  const res = await fetch("/api/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: listing.title,
      bullets: listing.bullets,
      description: listing.description,
      category: listing.category,
      brand: listing.brand,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data as {
    title: string;
    bullets: string;
    description: string | null;
  };
}

export function BulkRewriteModal({
  candidates,
  onClose,
}: BulkRewriteModalProps) {
  const { updateListing } = useAppData();
  const budget = getAiActionsRemaining();
  const capped = candidates.slice(0, Math.max(budget, 0));
  const skippedCount = candidates.length - capped.length;

  const [items, setItems] = useState<QueueItem[]>(
    capped.map((listing) => ({ listing, status: "pending" }))
  );
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const finished =
    started && doneCount + errorCount === items.length;

  async function start() {
    setStarted(true);
    setRunning(true);

    for (let i = 0; i < items.length; i++) {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === i ? { ...it, status: "loading" } : it
        )
      );

      try {
        const result = await rewriteOne(items[i].listing);
        recordAiAction();
        updateListing(items[i].listing.id, {
          aiRewriteTitle: result.title,
          aiRewriteBullets: result.bullets,
          aiRewriteDescription: result.description,
        });
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: "done",
                  title: result.title,
                  bullets: result.bullets,
                  description: result.description ?? undefined,
                }
              : it
          )
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: "error",
                  error:
                    err instanceof Error
                      ? err.message
                      : "Something went wrong.",
                }
              : it
          )
        );
      }
    }

    setRunning(false);
  }

  function exportCsv() {
    const rows = items
      .filter((i) => i.status === "done")
      .map((i) => ({
        SKU: i.listing.sku,
        "Original Title": i.listing.title,
        "New Title": i.title ?? "",
        "New Bullets": i.bullets ?? "",
        "New Description": i.description ?? "",
      }));
    if (rows.length === 0) return;

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-rewrites-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center
        justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl border
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
              Bulk AI Rewrite
            </h3>
            <p className="text-text-muted text-xs mt-0.5">
              {items.length} listing{items.length === 1 ? "" : "s"}{" "}
              queued
              {skippedCount > 0 &&
                ` · ${skippedCount} more skipped — demo AI budget covers ${budget} action${budget === 1 ? "" : "s"} per visitor`}
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
        <div className="px-5 py-5 flex flex-col gap-4">
          {items.length === 0 && (
            <p className="text-sm text-text-muted">
              No AI budget left for this visitor — try the single
              &quot;Suggest Rewrite&quot; button once it resets, or
              come back later.
            </p>
          )}

          {items.length > 0 && !started && (
            <button
              onClick={start}
              className="w-full rounded-lg py-3 text-sm font-semibold
                transition-opacity hover:opacity-90"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--ink)",
              }}
            >
              Generate {items.length} rewrite
              {items.length === 1 ? "" : "s"}
            </button>
          )}

          {started && (
            <>
              <p className="text-xs text-text-muted">
                {doneCount + errorCount} of {items.length} processed
                {running && " — working…"}
              </p>

              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <div
                    key={item.listing.id}
                    className="rounded-lg px-3 py-2.5"
                    style={{ backgroundColor: "var(--panel-raised)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-mono text-text-primary">
                        {item.listing.sku}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    {item.status === "done" && (
                      <p className="text-xs text-text-muted mt-1.5 truncate">
                        {item.title}
                      </p>
                    )}
                    {item.status === "error" && (
                      <p
                        className="text-xs mt-1.5"
                        style={{ color: "var(--negative)" }}
                      >
                        {item.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {finished && doneCount > 0 && (
            <button
              onClick={exportCsv}
              className="w-full rounded-lg py-3 text-sm font-medium
                border border-hairline text-text-primary
                hover:border-accent hover:text-accent
                transition-colors"
            >
              ⬇ Export {doneCount} rewrite{doneCount === 1 ? "" : "s"} as CSV
            </button>
          )}

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            These are suggestions only — nothing in your catalog data
            has changed. Export the CSV and merge what you want back
            into your real feed file.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: QueueItem["status"] }) {
  const map: Record<
    QueueItem["status"],
    { label: string; color: string }
  > = {
    pending: { label: "Queued", color: "var(--text-muted)" },
    loading: { label: "Generating…", color: "var(--accent)" },
    done: { label: "✓ Done", color: "var(--positive)" },
    error: { label: "✕ Failed", color: "var(--negative)" },
    skipped: { label: "Skipped", color: "var(--text-muted)" },
  };
  const { label, color } = map[status];
  return (
    <span className="text-xs font-medium" style={{ color }}>
      {label}
    </span>
  );
}
