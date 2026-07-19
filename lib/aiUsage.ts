// This app has no login system, so per-visitor AI usage is tracked
// in the browser's own storage rather than a real account — a
// friendly cap for a public demo, not a hard security wall. Every
// AI-powered feature (rewrite, bulk rewrite, compliance scan,
// duplicate verdict, executive summary) draws from this same shared
// budget, so a visitor can't bypass the limit by using a different
// feature — and a bulk action can't burn through hundreds of calls
// on one click.
const USAGE_KEY = "catalog-auditor:ai-actions-used";
export const DEMO_AI_BUDGET = 8;

export function getAiActionsUsed(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(USAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return isNaN(n) ? 0 : n;
}

export function getAiActionsRemaining(): number {
  return Math.max(0, DEMO_AI_BUDGET - getAiActionsUsed());
}

export function hasAiActionsRemaining(): boolean {
  return getAiActionsRemaining() > 0;
}

// Call once per successful AI call (not per attempt — failed
// requests shouldn't cost the visitor their budget).
export function recordAiAction(count = 1): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    USAGE_KEY,
    String(getAiActionsUsed() + count)
  );
}
