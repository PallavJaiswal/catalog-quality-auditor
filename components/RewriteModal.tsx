"use client";

import { useEffect, useRef, useState } from "react";
import type { AuditedListing } from "@/lib/types";
import { useAppData } from "@/lib/store";

interface RewriteModalProps {
  listing: AuditedListing;
  onClose: () => void;
}

interface RewriteResult {
  title: string;
  bullets: string;
  description: string | null;
}

export function RewriteModal({ listing, onClose }: RewriteModalProps) {
  const { updateListing } = useAppData();
  const cached = listing.aiRewriteTitle
    ? {
        title: listing.aiRewriteTitle,
        bullets: listing.aiRewriteBullets ?? "",
        description: listing.aiRewriteDescription,
      }
    : null;

  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RewriteResult | null>(cached);
  const [limitReached, setLimitReached] = useState(false);
  const [copied, setCopied] =
    useState<"title" | "bullets" | "description" | null>(null);

  // A plain incrementing counter, not a mounted/unmounted boolean —
  // React StrictMode deliberately mounts effects twice in dev, and a
  // boolean flag gets flipped back to "active" by the second mount
  // before the first request resolves, so both requests apply their
  // results (double AI spend for one click). Each effect run gets
  // its own id; a request only applies if it's still the latest one.
  const requestIdRef = useRef(0);

  async function generate() {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    try {
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

      if (res.status === 429) {
        if (requestIdRef.current === requestId) setLimitReached(true);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      if (requestIdRef.current === requestId) {
        setResult({
          title: data.title,
          bullets: data.bullets,
          description: data.description ?? null,
        });
        updateListing(listing.id, {
          aiRewriteTitle: data.title,
          aiRewriteBullets: data.bullets,
          aiRewriteDescription: data.description ?? null,
        });
      }
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong generating the rewrite."
        );
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    if (!cached) {
      // generate() fetches from the AI route; the setState calls it
      // makes all happen after that await, not synchronously here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);

  function handleCopy(
    field: "title" | "bullets" | "description",
    text: string
  ) {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
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
            <h3 className="section-title text-text-primary">
              AI Rewrite Suggestion
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
            <div>
              <p
                className="text-sm"
                style={{ color: "var(--warning)" }}
              >
                This is a demo version, limited to a handful of AI
                actions per visitor — thanks for trying it out! Feel
                free to explore everything else in the tool.
              </p>
            </div>
          )}

          {!limitReached && loading && (
            <p className="text-text-muted text-sm">
              Asking the AI for a rewrite…
            </p>
          )}

          {!limitReached && error && (
            <div>
              <p
                className="text-sm"
                style={{ color: "var(--negative)" }}
              >
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

          {!limitReached && !loading && !error && result && (
            <div className="flex flex-col gap-5">
              {/* Title comparison */}
              <div>
                <p className="mono-label text-text-muted mb-2">
                  Title
                </p>
                <div className="flex flex-col gap-2">
                  <div
                    className="text-sm px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: "var(--panel-raised)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {listing.title || "(no title)"}
                  </div>
                  <div
                    className="text-sm px-3 py-2 rounded-lg
                      border flex items-start justify-between
                      gap-3"
                    style={{
                      borderColor: "var(--accent)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <span>{result.title}</span>
                    <button
                      onClick={() =>
                        handleCopy("title", result.title)
                      }
                      className="text-xs shrink-0 px-2 py-1
                        rounded-md hover:text-accent"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {copied === "title" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bullets comparison */}
              <div>
                <p className="mono-label text-text-muted mb-2">
                  Bullets
                </p>
                <div className="flex flex-col gap-2">
                  <div
                    className="text-sm px-3 py-2 rounded-lg
                      whitespace-pre-line"
                    style={{
                      backgroundColor: "var(--panel-raised)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {listing.bullets || "(none provided)"}
                  </div>
                  <div
                    className="text-sm px-3 py-2 rounded-lg
                      border whitespace-pre-line flex
                      items-start justify-between gap-3"
                    style={{
                      borderColor: "var(--accent)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <span>{result.bullets}</span>
                    <button
                      onClick={() =>
                        handleCopy("bullets", result.bullets)
                      }
                      className="text-xs shrink-0 px-2 py-1
                        rounded-md hover:text-accent"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {copied === "bullets" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Description — only shown when the AI generated one
                  (i.e. the listing had none to begin with) */}
              {result.description && (
                <div>
                  <p className="mono-label text-text-muted mb-2">
                    Description{" "}
                    <span className="normal-case font-normal">
                      (was missing — AI generated one)
                    </span>
                  </p>
                  <div
                    className="text-sm px-3 py-2 rounded-lg
                      border whitespace-pre-line flex
                      items-start justify-between gap-3"
                    style={{
                      borderColor: "var(--accent)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <span>{result.description}</span>
                    <button
                      onClick={() =>
                        handleCopy("description", result.description!)
                      }
                      className="text-xs shrink-0 px-2 py-1
                        rounded-md hover:text-accent"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {copied === "description" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              <p
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                This is a suggestion only — nothing in your catalog
                data has changed. It&apos;s saved to this session so
                you can revisit it without spending another AI
                action. Copy what you want to use.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
