import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai";
import { consume, getRemaining, limitReachedResponse } from "@/lib/rateLimit";

interface ListingInput {
  title: string;
  bullets?: string;
  description?: string;
  category?: string;
  brand?: string;
}

function buildPrompt({
  title,
  bullets,
  description,
  category,
  brand,
}: ListingInput): string {
  const needsDescription = !description || !description.trim();

  return `You are an e-commerce copywriter improving a product listing for search visibility and clarity.

Current listing:
Title: ${title}
Bullets: ${bullets || "(none provided)"}
Description: ${description || "(none provided)"}
Category: ${category || "(unknown)"}
Brand: ${brand || "(unknown)"}

Rewrite the title and bullet points to be clear, keyword-rich, and free of filler words. Keep the title under 200 characters. Write 3-5 concise bullet points.${
    needsDescription
      ? " The listing has no description — write one (2-4 sentences, benefit-focused)."
      : ""
  }

Respond with ONLY valid JSON in this exact shape, no other text:
{"title": "...", "bullets": "bullet one\\nbullet two\\nbullet three"${
    needsDescription ? ', "description": "..."' : ""
  }}`;
}

export async function POST(request: NextRequest) {
  if (getRemaining(request, "rewrite") <= 0) {
    return limitReachedResponse();
  }

  try {
    const { title, bullets, description, category, brand } =
      await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "A listing title is required." },
        { status: 400 }
      );
    }

    const prompt = buildPrompt({
      title,
      bullets,
      description,
      category,
      brand,
    });

    const cleaned = await callAi(prompt);

    let parsed: {
      title: string;
      bullets: string;
      description?: string;
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

    const response = NextResponse.json({
      title: parsed.title,
      bullets: parsed.bullets,
      description: parsed.description ?? null,
    });
    consume(request, response, "rewrite");
    return response;
  } catch (error) {
    console.error("Rewrite request failed:", error);
    return NextResponse.json(
      { error: "Something went wrong generating the rewrite." },
      { status: 500 }
    );
  }
}
