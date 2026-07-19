"use client";

import { useState } from "react";
import type { ColumnMapping } from "@/lib/types";

interface ColumnMappingModalProps {
  headers: string[];
  initialMapping: ColumnMapping;
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

// Single-value fields — the user picks exactly one column each.
const SINGLE_FIELDS: {
  key:
    | "sku"
    | "title"
    | "description"
    | "category"
    | "brand"
    | "price"
    | "parent_sku"
    | "product_url";
  label: string;
  required?: boolean;
  hint?: string;
}[] = [
  { key: "sku", label: "SKU", required: true },
  { key: "title", label: "Title", required: true },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price" },
  { key: "description", label: "Description" },
  {
    key: "parent_sku",
    label: "Parent SKU",
    hint:
      "Only if your file groups color/size variants under a parent " +
      "listing (e.g. Amazon's parent_sku). Leave unmapped otherwise " +
      "— siblings will be correctly compared as standalone listings.",
  },
  {
    key: "product_url",
    label: "Product Link",
    hint:
      "Optional — a link to the manufacturer's page or any other " +
      "source page for this product. When mapped, you can generate " +
      "title/bullets/description grounded in that page's real content.",
  },
];

// Multi-value fields — real files often spread these across
// several columns, so more than one can be selected.
const MULTI_FIELDS: {
  key: "bullets" | "image_count";
  label: string;
}[] = [
  { key: "bullets", label: "Bullet Points" },
  { key: "image_count", label: "Images" },
];

export function ColumnMappingModal({
  headers,
  initialMapping,
  onConfirm,
  onCancel,
}: ColumnMappingModalProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);

  function setSingle(
    key: (typeof SINGLE_FIELDS)[number]["key"],
    value: string
  ) {
    setMapping((m) => ({ ...m, [key]: value }));
  }

  function toggleMulti(
    key: (typeof MULTI_FIELDS)[number]["key"],
    header: string
  ) {
    setMapping((m) => {
      const current = m[key];
      const next = current.includes(header)
        ? current.filter((h) => h !== header)
        : [...current, header];
      return { ...m, [key]: next };
    });
  }

  const missingRequired = SINGLE_FIELDS.filter(
    (f) => f.required && !mapping[f.key]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center
        justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="w-full max-w-xl rounded-xl border
          border-hairline max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: "var(--panel)" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-hairline">
          <h3 className="section-title text-text-primary">
            Confirm Column Mapping
          </h3>
          <p className="text-text-muted text-xs mt-1">
            We matched your file&apos;s columns automatically —
            double-check them below and fix anything that looks
            wrong before we run the audit.
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-5">
          {/* Single-select fields */}
          {SINGLE_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium text-text-primary
                  flex items-center gap-1"
              >
                {field.label}
                {field.required && (
                  <span style={{ color: "var(--negative)" }}>*</span>
                )}
              </label>
              {field.hint && (
                <p className="text-xs text-text-muted -mt-1">
                  {field.hint}
                </p>
              )}
              <select
                value={mapping[field.key]}
                onChange={(e) => setSingle(field.key, e.target.value)}
                className="text-sm px-3 py-2 rounded-lg
                  border border-hairline bg-panel-raised
                  text-text-primary focus:outline-none
                  focus:border-accent"
              >
                <option value="">— Not mapped —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {/* Multi-select fields */}
          {MULTI_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-primary">
                {field.label}
              </label>
              <p className="text-xs text-text-muted -mt-1">
                Select one or more columns — useful when a file
                splits these across several columns.
              </p>
              <div className="flex flex-wrap gap-2">
                {headers.map((h) => {
                  const active = mapping[field.key].includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleMulti(field.key, h)}
                      className="px-3 py-1.5 rounded-lg text-xs
                        font-medium transition-colors"
                      style={{
                        backgroundColor: active
                          ? "var(--accent)"
                          : "var(--panel-raised)",
                        color: active ? "var(--ink)" : "var(--text-muted)",
                      }}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {missingRequired.length > 0 && (
            <p className="text-xs" style={{ color: "var(--warning)" }}>
              ⚠ {missingRequired.map((f) => f.label).join(", ")}{" "}
              {missingRequired.length === 1 ? "isn't" : "aren't"} mapped
              — those listings will show up flagged as missing that
              field, which may be exactly right if your file genuinely
              doesn&apos;t have it.
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 border-t border-hairline
            flex items-center justify-end gap-3"
        >
          <button
            onClick={onCancel}
            className="text-sm px-4 py-2 rounded-lg
              border border-hairline text-text-primary
              hover:border-accent hover:text-accent
              transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(mapping)}
            className="text-sm px-4 py-2 rounded-lg font-medium
              transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--ink)",
            }}
          >
            Confirm &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}
