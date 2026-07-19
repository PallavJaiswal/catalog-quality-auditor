import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai";
import { consume, getRemaining, limitReachedResponse } from "@/lib/rateLimit";

interface SummaryInput {
  filename: string;
  totalListings: number;
  missingFieldsCount: number;
  duplicatesCount: number;
  skuCollisionsCount: number;
  highRiskCount: number;
  averageSeoScore: number | null;
  topIssueCounts: Record<string, number>;
  worstListings: {
    sku: string;
    title: string;
    complianceRisk: string;
    missingFields: string[];
    skuCollision: boolean;
    isDuplicate: boolean;
  }[];
}

function buildPrompt(input: SummaryInput): string {
  const issueLines = Object.entries(input.topIssueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([issue, count]) => `- ${issue}: ${count} listing(s)`)
    .join("\n");

  const worstLines = input.worstListings
    .slice(0, 15)
    .map(
      (l) =>
        `- ${l.sku} (${l.complianceRisk} risk${l.skuCollision ? ", duplicate SKU" : ""}${l.isDuplicate ? ", duplicate title" : ""}): ${l.title || "(no title)"}`
    )
    .join("\n");

  return `You are a senior e-commerce catalog manager writing a short executive summary of a catalog quality audit for a stakeholder (not a technical person). Be direct and specific, reference real numbers and SKUs from the data below, and prioritize what to fix first. No fluff, no generic advice.

File: ${input.filename}
Total listings: ${input.totalListings}
Listings with missing/weak fields: ${input.missingFieldsCount}
Duplicate SKUs (same SKU reused across rows — will overwrite on upload): ${input.skuCollisionsCount}
Title-similarity duplicates: ${input.duplicatesCount}
High risk listings: ${input.highRiskCount}
Average SEO score: ${input.averageSeoScore ?? "N/A"}/100

Most common issues:
${issueLines || "(none)"}

Sample of the highest-risk listings:
${worstLines || "(none)"}

Write a 4-6 sentence executive summary as plain text — this gets displayed verbatim with no markdown rendering, so do not use #, *, **, -, or any other markdown syntax; use plain paragraphs only, no headers and no bullet lists. Call out the single most urgent problem by name, reference specific SKUs where useful, and end with one clear recommended next action.`;
}

export async function POST(request: NextRequest) {
  if (getRemaining(request, "summary") <= 0) {
    return limitReachedResponse();
  }

  try {
    const input = (await request.json()) as SummaryInput;

    if (!input.filename || typeof input.totalListings !== "number") {
      return NextResponse.json(
        { error: "Audit summary data is required." },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(input);
    const summary = await callAi(prompt);

    const response = NextResponse.json({ summary });
    consume(request, response, "summary");
    return response;
  } catch (error) {
    console.error("Summary request failed:", error);
    return NextResponse.json(
      { error: "Something went wrong generating the summary." },
      { status: 500 }
    );
  }
}
