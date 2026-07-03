import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Which AI provider generates rewrites, controlled by one setting
// instead of two separate copies of this project. Set AI_PROVIDER
// to "claude" locally to keep testing/comparing with Claude. Leave
// it unset (or set to "groq") anywhere this might run publicly —
// that's the safer default, since Groq's free tier means a
// stranger clicking around can't run up a real bill.
const AI_PROVIDER =
  (process.env.AI_PROVIDER ?? "").trim().toLowerCase() === "claude"
    ? "claude"
    : "groq";

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
  return `You are an e-commerce copywriter improving a product listing for search visibility and clarity.

Current listing:
Title: ${title}
Bullets: ${bullets || "(none provided)"}
Description: ${description || "(none provided)"}
Category: ${category || "(unknown)"}
Brand: ${brand || "(unknown)"}

Rewrite the title and bullet points to be clear, keyword-rich, and free of filler words. Keep the title under 200 characters. Write 3-5 concise bullet points.

Respond with ONLY valid JSON in this exact shape, no other text:
{"title": "...", "bullets": "bullet one\\nbullet two\\nbullet three"}`;
}

async function callClaude(prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

async function callGroq(prompt: string): Promise<string> {
  // Groq's API is OpenAI-compatible, so this is a plain fetch to
  // their chat completions endpoint rather than a dedicated SDK.
  const groqResponse = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );

  if (!groqResponse.ok) {
    const errText = await groqResponse.text();
    console.error("Groq request failed:", groqResponse.status, errText);
    throw new Error("Something went wrong generating the rewrite.");
  }

  const data = await groqResponse.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function POST(request: NextRequest) {
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

    const responseText =
      AI_PROVIDER === "claude"
        ? await callClaude(prompt)
        : await callGroq(prompt);

    // Models sometimes wrap JSON in code fences even when asked
    // not to — strip them defensively before parsing.
    const cleaned = responseText.replace(/```json|```/g, "").trim();

    let parsed: { title: string; bullets: string };
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

    return NextResponse.json({
      title: parsed.title,
      bullets: parsed.bullets,
    });
  } catch (error) {
    console.error("Rewrite request failed:", error);
    return NextResponse.json(
      { error: "Something went wrong generating the rewrite." },
      { status: 500 }
    );
  }
}
