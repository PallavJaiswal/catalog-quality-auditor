"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import type { AuditResult, AuditedListing } from "./types";

// ─── Pipeline stages ─────────────────────────────────────────
// These are the steps shown during processing.
// The user sees each one light up in sequence.
export type PipelineStage =
  | "idle"
  | "parsing"
  | "validating"
  | "duplicates"
  | "scoring"
  | "done"
  | "error";

export const PIPELINE_STAGES: {
  key: PipelineStage;
  label: string;
}[] = [
  { key: "parsing",    label: "Reading file"         },
  { key: "validating", label: "Checking fields"      },
  { key: "duplicates", label: "Finding duplicates"   },
  { key: "scoring",    label: "Scoring listings"     },
];

// ─── Context shape ───────────────────────────────────────────
// Everything the rest of the app can read or call.
interface AppContextValue {
  // The finished audit result
  auditResult: AuditResult | null;

  // Which stage the pipeline is currently on
  stage: PipelineStage;

  // Any error message to show the user
  error: string | null;

  // Called by the upload page to kick off the pipeline
  runAudit: (
    rows: import("./types").RawCatalogRow[],
    filename: string
  ) => Promise<void>;

  // Patches one listing in place (by its stable row id, not SKU —
  // SKUs aren't guaranteed unique). Used to save AI results back
  // into the audit: an applied rewrite, a compliance scan, a
  // duplicate verdict.
  updateListing: (
    id: string,
    patch: Partial<AuditedListing>
  ) => void;

  // Called to clear everything and start over
  reset: () => void;
}

// ─── Create the context ──────────────────────────────────────
const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider component ──────────────────────────────────────
// Wrap the whole app in this so every page can access the data.
export function AppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [auditResult, setAuditResult] =
    useState<AuditResult | null>(null);
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setAuditResult(null);
    setStage("idle");
    setError(null);
  }, []);

  const runAudit = useCallback(
    async (
      rows: import("./types").RawCatalogRow[],
      filename: string
    ) => {
      setError(null);
      setAuditResult(null);

      try {
        // ── Stage 1: Validate ──────────────────────────────
        setStage("validating");
        await pause();
        const { validateAllListings } = await import(
          "./validation"
        );
        let listings: AuditedListing[] =
          validateAllListings(rows);

        // ── Stage 2: Find duplicates ───────────────────────
        setStage("duplicates");
        await pause();
        const {
          detectDuplicates,
          detectSkuCollisions,
          reconcileVariationParentPricing,
        } = await import("./duplicates");
        listings = reconcileVariationParentPricing(listings);
        listings = detectDuplicates(listings);
        listings = detectSkuCollisions(listings);

        // ── Stage 3: Score listings ────────────────────────
        setStage("scoring");
        await pause();
        listings = listings.map((l) => ({
          ...l,
          seoScore: calculateLocalSeoScore(l),
        }));

        // ── Build final result ─────────────────────────────
        const missingFieldsCount = listings.filter(
          (l) => l.missingFields.length > 0
        ).length;

        const duplicatesCount = listings.filter(
          (l) => l.isDuplicate || l.skuCollision
        ).length;

        const highRiskCount = listings.filter(
          (l) => l.complianceRisk === "high"
        ).length;

        const scores = listings
          .map((l) => l.seoScore)
          .filter((s): s is number => s !== null);

        const averageSeoScore =
          scores.length > 0
            ? Math.round(
                scores.reduce((a, b) => a + b, 0) / scores.length
              )
            : null;

        setAuditResult({
          uploadedAt: new Date().toISOString(),
          filename,
          totalListings: listings.length,
          listings,
          missingFieldsCount,
          duplicatesCount,
          highRiskCount,
          averageSeoScore,
        });

        setStage("done");
                // Save to localStorage for Reports page
        try {
        const existing = localStorage.getItem(
            "catalog-auditor:reports"
        );
        const history: AuditResult[] = existing
            ? JSON.parse(existing)
            : [];

        // Add new report to front of list
        // Keep last 10 reports only
        const updated = [
            {
            uploadedAt: new Date().toISOString(),
            filename,
            totalListings: listings.length,
            listings,
            missingFieldsCount,
            duplicatesCount,
            highRiskCount,
            averageSeoScore,
            },
            ...history,
        ].slice(0, 10);

        localStorage.setItem(
            "catalog-auditor:reports",
            JSON.stringify(updated)
        );
        } catch {
        // localStorage unavailable — non-fatal, just skip saving
        }
      } catch (err) {
        setError((err as Error).message);
        setStage("error");
      }
    },
    []
  );

  const updateListing = useCallback(
    (id: string, patch: Partial<AuditedListing>) => {
      setAuditResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          listings: prev.listings.map((l) =>
            l.id === id ? { ...l, ...patch } : l
          ),
        };
      });
    },
    []
  );

  return (
    <AppContext.Provider
      value={{
        auditResult,
        stage,
        error,
        runAudit,
        updateListing,
        reset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────
// Any component calls useAppData() to access the context.
export function useAppData(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error(
      "useAppData must be used inside AppProvider"
    );
  }
  return ctx;
}

// ─── Local SEO scoring ───────────────────────────────────────
// Scores each listing 0-100 based on measurable quality signals.
// No AI needed for this — pure rule-based calculation.
// AI rewrites come later as a separate optional step.
function calculateLocalSeoScore(
  listing: AuditedListing
): number {
  let score = 0;

  // Title quality (30 points)
  const titleLen = listing.title.length;
  if (titleLen >= 80)       score += 30;
  else if (titleLen >= 60)  score += 22;
  else if (titleLen >= 40)  score += 14;
  else                      score += 0;

  // Bullet quality (25 points)
  const bullets = listing.bullets
    .split("|")
    .filter(Boolean);
  if (bullets.length >= 5)      score += 25;
  else if (bullets.length >= 3) score += 16;
  else if (bullets.length >= 1) score += 8;

  // Description quality (20 points)
  const descLen = listing.description.length;
  if (descLen >= 300)      score += 20;
  else if (descLen >= 150) score += 13;
  else if (descLen >= 50)  score += 7;

  // Image count (15 points)
  if (listing.imageCount >= 7)      score += 15;
  else if (listing.imageCount >= 5) score += 10;
  else if (listing.imageCount >= 3) score += 5;

  // Has price (5 points)
  if (listing.price > 0) score += 5;

  // Has category (5 points)
  if (listing.category && listing.category !== "Uncategorized") {
    score += 5;
  }

  return Math.min(score, 100);
}

// ─── Utility ─────────────────────────────────────────────────
// Small pause between stages so the UI can visibly 
// update — without this everything happens so fast
// the user never sees the pipeline steps.
function pause(ms = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}