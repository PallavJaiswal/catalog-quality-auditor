import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai";
import { fetchProductPage, ScrapeError } from "@/lib/scrape";
import { findVerbatimOverlap } from "@/lib/originality";
import { consume, getRemaining, limitReachedResponse } from "@/lib/rateLimit";

type Field = "title" | "bullets" | "description";
const ALL_FIELDS: Field[] = ["title", "bullets", "description"];

function buildPrompt(
  fields: Field[],
  sourceTitle: string,
  sourceMetaDescription: string,
  sourceText: string,
  context: { sku: string; brand?: string; category?: string }
): string {
  const shape = fields
    .map((f) => `"${f}": ${f === "bullets" ? '"bullet one\\nbullet two\\nbullet three"' : '"..."'}`)
    .join(", ");

  return `You are an e-commerce copywriter. Below is content extracted from a product's page on the manufacturer's (or another source) website. Use it as your factual source, but you must NOT copy any sentence or distinctive phrase verbatim — rewrite everything entirely in your own words, with different sentence structure. This is for copyright/originality reasons: the output must read as an independent rewrite, not a copy.

Only state facts that are actually present in the source content below — do not invent specifications, claims, or features that aren't mentioned.

Source page title: ${sourceTitle || "(none)"}
Source page summary: ${sourceMetaDescription || "(none)"}
Source page content:
"""
${sourceText}
"""

Known catalog context for this listing — SKU ${context.sku}${context.brand ? `, brand ${context.brand}` : ""}${context.category ? `, category ${context.category}` : ""}.

Write ${fields.length === 1 ? "a" : ""} ${fields.join(", ")} for an Amazon-style listing, grounded in the source content above, entirely rewritten in your own words. ${fields.includes("title") ? "Keep the title under 200 characters." : ""} ${fields.includes("bullets") ? "Write 3-5 concise bullet points." : ""} ${fields.includes("description") ? "Write a 2-4 sentence description." : ""}

Respond with ONLY valid JSON in this exact shape, no other text:
{${shape}}`;
}

export async function POST(request: NextRequest) {
  if (getRemaining(request, "generate-from-link") <= 0) {
    return limitReachedResponse();
  }

  try {
    const {
      url,
      sku,
      brand,
      category,
      fields: requestedFields,
    } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "A product URL is required." },
        { status: 400 }
      );
    }

    const fields: Field[] =
      Array.isArray(requestedFields) && requestedFields.length > 0
        ? requestedFields.filter((f: string): f is Field =>
            ALL_FIELDS.includes(f as Field)
          )
        : ALL_FIELDS;

    let page;
    try {
      page = await fetchProductPage(url);
    } catch (err) {
      if (err instanceof ScrapeError) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      throw err;
    }

    const prompt = buildPrompt(
      fields,
      page.title,
      page.metaDescription,
      page.text,
      { sku, brand, category }
    );

    const cleaned = await callAi(prompt);

    let parsed: Record<string, string>;
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

    // Mechanical safety net on top of the "don't copy verbatim"
    // instruction — flag any long run of words that matches the
    // source page exactly, per field.
    const overlapWarnings: string[] = [];
    for (const field of fields) {
      const value = parsed[field];
      if (!value) continue;
      const overlaps = findVerbatimOverlap(value, page.text);
      overlapWarnings.push(...overlaps);
    }

    const response = NextResponse.json({
      title: parsed.title ?? null,
      bullets: parsed.bullets ?? null,
      description: parsed.description ?? null,
      sourcePageTitle: page.title,
      overlapWarnings: [...new Set(overlapWarnings)].slice(0, 5),
    });
    consume(request, response, "generate-from-link");
    return response;
  } catch (error) {
    console.error("Generate-from-link request failed:", error);
    return NextResponse.json(
      { error: "Something went wrong generating content from that link." },
      { status: 500 }
    );
  }
}
