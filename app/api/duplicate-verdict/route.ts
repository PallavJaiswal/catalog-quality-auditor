import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai";

interface ListingSide {
  sku: string;
  title: string;
  bullets?: string;
  description?: string;
}

function buildPrompt(a: ListingSide, b: ListingSide): string {
  return `You are a catalog manager deciding whether two product listings are the same listing duplicated, two variants of one product (different size/color/pack), or genuinely different products that just happen to share similar wording.

Listing A (${a.sku}):
Title: ${a.title}
Bullets: ${a.bullets || "(none provided)"}
Description: ${a.description || "(none provided)"}

Listing B (${b.sku}):
Title: ${b.title}
Bullets: ${b.bullets || "(none provided)"}
Description: ${b.description || "(none provided)"}

Respond with ONLY valid JSON, no other text, in this exact shape:
{"verdict": "same-listing" | "likely-variant" | "different-product", "reason": "one sentence explaining the call"}

Use "same-listing" only if these look like the exact same sellable item duplicated under two SKUs. Use "likely-variant" if they're the same base product in a different size/color/pack/capacity (a legitimate variation, not a duplicate). Use "different-product" if they are meaningfully different items.`;
}

export async function POST(request: NextRequest) {
  try {
    const { a, b } = await request.json();

    if (!a?.title || !b?.title) {
      return NextResponse.json(
        { error: "Both listings' titles are required." },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(a, b);
    const cleaned = await callAi(prompt);

    let parsed: { verdict: string; reason: string };
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

    const verdict =
      parsed.verdict === "same-listing" ||
      parsed.verdict === "different-product"
        ? parsed.verdict
        : "likely-variant";

    return NextResponse.json({
      verdict,
      reason: String(parsed.reason ?? ""),
    });
  } catch (error) {
    console.error("Duplicate verdict request failed:", error);
    return NextResponse.json(
      { error: "Something went wrong comparing these listings." },
      { status: 500 }
    );
  }
}
