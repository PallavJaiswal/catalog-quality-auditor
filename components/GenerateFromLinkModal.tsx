"use client";

import { useState } from "react";
import type { AuditedListing } from "@/lib/types";
import { useAppData } from "@/lib/store";

interface GenerateFromLinkModalProps {
  listing: AuditedListing;
  onClose: () => void;
}

type Field = "title" | "bullets" | "description";

interface Result {
  title: string | null;
  bullets: string | null;
  description: string | null;
  sourcePageTitle: string;
  overlapWarnings: string[];
}

export function GenerateFromLinkModal({
  listing,
  onClose,
}: GenerateFromLinkModalProps) {
  const { updateListing } = useAppData();
  const [loading, setLoading] = useState<Field | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [copied, setCopied] = useState<Field | null>(null);

  async function generate(fields: Field[], key: Field | "all") {
    setLoading(key);
    setError(null);
    try {
      const res = await fetch("/api/generate-from-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: listing.productUrl,
          sku: listing.sku,
          brand: listing.brand,
          category: listing.category,
          fields,
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setLimitReached(true);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setResult((prev) => ({
        title: data.title ?? prev?.title ?? null,
        bullets: data.bullets ?? prev?.bullets ?? null,
        description: data.description ?? prev?.description ?? null,
        sourcePageTitle: data.sourcePageTitle,
        overlapWarnings: data.overlapWarnings ?? [],
      }));

      updateListing(listing.id, {
        ...(data.title ? { aiRewriteTitle: data.title } : {}),
        ...(data.bullets ? { aiRewriteBullets: data.bullets } : {}),
        ...(data.description
          ? { aiRewriteDescription: data.description }
          : {}),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong generating content from that link."
      );
    } finally {
      setLoading(null);
    }
  }

  function handleCopy(field: Field, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  }

  const busy = loading !== null;

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
              Generate from Product Link
            </h3>
            <p className="text-text-muted text-xs mt-0.5 font-mono">
              {listing.sku}
            </p>
            <p
              className="text-xs mt-1 truncate max-w-md"
              style={{ color: "var(--accent)" }}
            >
              🔗 {listing.productUrl}
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
        <div className="px-5 py-5 flex flex-col gap-5">
          {limitReached && (
            <p className="text-sm" style={{ color: "var(--warning)" }}>
              This is a demo version, limited to a handful of AI
              actions per visitor — thanks for trying it out! Feel
              free to explore everything else in the tool.
            </p>
          )}

          {!limitReached && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => generate(["title"], "title")}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-lg
                    border border-hairline text-text-primary
                    hover:border-accent hover:text-accent
                    transition-colors disabled:opacity-50"
                >
                  {loading === "title" ? "Generating…" : "Generate Title"}
                </button>
                <button
                  onClick={() => generate(["bullets"], "bullets")}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-lg
                    border border-hairline text-text-primary
                    hover:border-accent hover:text-accent
                    transition-colors disabled:opacity-50"
                >
                  {loading === "bullets" ? "Generating…" : "Generate Bullets"}
                </button>
                <button
                  onClick={() => generate(["description"], "description")}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-lg
                    border border-hairline text-text-primary
                    hover:border-accent hover:text-accent
                    transition-colors disabled:opacity-50"
                >
                  {loading === "description"
                    ? "Generating…"
                    : "Generate Description"}
                </button>
                <button
                  onClick={() =>
                    generate(["title", "bullets", "description"], "all")
                  }
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium
                    transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--ink)",
                  }}
                >
                  {loading === "all" ? "Generating…" : "✨ Generate All"}
                </button>
              </div>

              {error && (
                <p className="text-sm" style={{ color: "var(--negative)" }}>
                  {error}
                </p>
              )}

              {result?.overlapWarnings && result.overlapWarnings.length > 0 && (
                <div
                  className="rounded-lg px-3 py-2.5 text-xs"
                  style={{
                    backgroundColor: "rgba(227,179,65,0.1)",
                    color: "var(--warning)",
                  }}
                >
                  ⚠ {result.overlapWarnings.length} phrase
                  {result.overlapWarnings.length > 1 ? "s" : ""} in the
                  generated text matched the source page word-for-word —
                  worth a manual check before using: &ldquo;
                  {result.overlapWarnings[0]}&rdquo;
                </div>
              )}

              {result?.title && (
                <FieldResult
                  label="Title"
                  value={result.title}
                  copied={copied === "title"}
                  onCopy={() => handleCopy("title", result.title!)}
                />
              )}
              {result?.bullets && (
                <FieldResult
                  label="Bullets"
                  value={result.bullets}
                  copied={copied === "bullets"}
                  onCopy={() => handleCopy("bullets", result.bullets!)}
                  multiline
                />
              )}
              {result?.description && (
                <FieldResult
                  label="Description"
                  value={result.description}
                  copied={copied === "description"}
                  onCopy={() =>
                    handleCopy("description", result.description!)
                  }
                  multiline
                />
              )}

              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Grounded in the linked page, but fully rewritten — not a
                copy of the source text. Nothing in your catalog data has
                changed; copy what you want to use.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldResult({
  label,
  value,
  copied,
  onCopy,
  multiline,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="mono-label text-text-muted mb-2">{label}</p>
      <div
        className={`text-sm px-3 py-2 rounded-lg border flex
          items-start justify-between gap-3 ${
            multiline ? "whitespace-pre-line" : ""
          }`}
        style={{
          borderColor: "var(--accent)",
          color: "var(--text-primary)",
        }}
      >
        <span>{value}</span>
        <button
          onClick={onCopy}
          className="text-xs shrink-0 px-2 py-1
            rounded-md hover:text-accent"
          style={{ color: "var(--text-muted)" }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
