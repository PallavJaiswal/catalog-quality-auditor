import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai";

interface ListingInput {
  title: string;
  bullets?: string;
  description?: string;
  category?: string;
}

function buildPrompt({
  title,
  bullets,
  description,
  category,
}: ListingInput): string {
  return `You are a marketplace compliance reviewer (Amazon/eBay/Walmart style policies). Scan this product listing copy for language that risks a policy rejection or suppression — not spelling or style issues, only genuine policy risk.

Look specifically for:
- Unsubstantiated medical/health claims ("cures", "treats", "FDA approved", "prevents disease")
- Absolute/guarantee claims that invite disputes ("100% guaranteed", "risk free", "best in the world")
- Prohibited superlatives without substantiation ("#1 rated", "clinically proven" without a citation)
- Contact info, URLs, or off-platform purchase prompts embedded in the copy
- Competitor brand names used to imply comparison or compatibility without permission
- Excessive capitalization or promotional price/urgency language in the title ("SALE!!!", "LIMITED TIME")
- Restricted-category language (weapons, supplements dosing claims, children's product safety claims) if present

Listing:
Title: ${title}
Bullets: ${bullets || "(none provided)"}
Description: ${description || "(none provided)"}
Category: ${category || "(unknown)"}

Respond with ONLY valid JSON, no other text, in this exact shape:
{"flags": [{"phrase": "the exact risky phrase", "reason": "one sentence on why it's risky", "severity": "low" | "medium" | "high"}]}

If nothing is risky, respond with {"flags": []}. Do not invent issues that aren't there — an empty list is a valid, expected result for a clean listing.`;
}

export async function POST(request: NextRequest) {
  try {
    const { title, bullets, description, category } =
      await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "A listing title is required." },
        { status: 400 }
      );
    }

    const prompt = buildPrompt({ title, bullets, description, category });
    const cleaned = await callAi(prompt);

    let parsed: {
      flags: { phrase: string; reason: string; severity: string }[];
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        {
          error:
            "The AI returned a response we couldn't parse. Try again.",
        },
        { status: 502 }
      );
    }

    const flags = (parsed.flags ?? []).map((f) => ({
      phrase: String(f.phrase ?? ""),
      reason: String(f.reason ?? ""),
      severity:
        f.severity === "high" || f.severity === "medium"
          ? f.severity
          : "low",
    }));

    return NextResponse.json({ flags });
  } catch (error) {
    console.error("Compliance scan failed:", error);
    return NextResponse.json(
      { error: "Something went wrong scanning this listing." },
      { status: 500 }
    );
  }
}
