import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Which AI provider powers every AI feature, controlled by one
// setting. Set AI_PROVIDER to "claude" locally to test/compare with
// Claude. Leave it unset (or set to "groq") anywhere this might run
// publicly — that's the safer default, since Groq's free tier means
// a stranger clicking around can't run up a real bill.
export const AI_PROVIDER =
  (process.env.AI_PROVIDER ?? "").trim().toLowerCase() === "claude"
    ? "claude"
    : "groq";

async function callClaude(prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
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
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );

  if (!groqResponse.ok) {
    const errText = await groqResponse.text();
    console.error("Groq request failed:", groqResponse.status, errText);
    throw new Error("Something went wrong talking to the AI.");
  }

  const data = await groqResponse.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Single entry point every AI route calls — keeps the provider
// switch and error handling in one place instead of duplicated
// across each route.
export async function callAi(prompt: string): Promise<string> {
  const raw =
    AI_PROVIDER === "claude"
      ? await callClaude(prompt)
      : await callGroq(prompt);

  // Models sometimes wrap JSON in code fences even when asked not
  // to — strip them defensively before the caller parses it.
  return raw.replace(/```json|```/g, "").trim();
}
