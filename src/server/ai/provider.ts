import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const log = logger.child("ai");

export type AiMessage = { role: "system" | "user"; content: string };

/**
 * Provider-agnostic AI client. Keys live only in server env. When
 * AI_PROVIDER=disabled (default), generation is skipped and callers fall back
 * to deterministic templating — the system never blocks on AI availability.
 *
 * CRITICAL: AI is only ever used to FORMAT already-verified data. Prompts must
 * instruct the model to never invent factual fields.
 */
export async function generate(messages: AiMessage[]): Promise<string | null> {
  if (env.ai.provider === "disabled" || !env.ai.apiKey) return null;

  try {
    if (env.ai.provider === "anthropic") return await callAnthropic(messages);
    if (env.ai.provider === "openai") return await callOpenAI(messages);
  } catch (err) {
    log.error("AI generation failed", { err: String(err) });
    return null;
  }
  return null;
}

async function callAnthropic(messages: AiMessage[]): Promise<string | null> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const userContent = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ai.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ai.model,
      max_tokens: env.ai.maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    log.error("Anthropic API error", { status: res.status, body: (await res.text()).slice(0, 300) });
    return null;
  }
  const json = (await res.json()) as { content?: { text?: string }[] };
  return json.content?.map((c) => c.text ?? "").join("") ?? null;
}

async function callOpenAI(messages: AiMessage[]): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: env.ai.model,
      max_tokens: env.ai.maxTokens,
      messages,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    log.error("OpenAI API error", { status: res.status, body: (await res.text()).slice(0, 300) });
    return null;
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? null;
}

/** Parse a JSON object from a model response that may be wrapped in prose/fences. */
export function parseJsonResponse<T>(raw: string | null): T | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
