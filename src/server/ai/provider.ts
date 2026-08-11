import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const log = logger.child("ai");

export type AiMessage = { role: "system" | "user"; content: string };

export type AiStatus = {
  enabled: boolean;
  provider: "anthropic" | "openai" | "disabled";
  model: string;
  configured: boolean;
};

/** Report the AI configuration without exposing the key. Safe for admin UI. */
export function aiStatus(): AiStatus {
  return {
    enabled: env.ai.provider !== "disabled" && Boolean(env.ai.apiKey),
    provider: env.ai.provider,
    model: env.ai.model,
    configured: Boolean(env.ai.apiKey),
  };
}

export function isAiEnabled(): boolean {
  return env.ai.provider !== "disabled" && Boolean(env.ai.apiKey);
}

/**
 * Provider-agnostic AI client. Keys live only in server env. When
 * AI_PROVIDER=disabled (default) or no key is set, generation is skipped and
 * callers fall back to deterministic templating — the system never blocks on AI
 * availability.
 *
 * CRITICAL: AI is only ever used to FORMAT already-verified data. Prompts must
 * instruct the model to never invent factual fields.
 */
export async function generate(
  messages: AiMessage[],
  opts?: { maxTokens?: number; retries?: number; throwOnError?: boolean }
): Promise<string | null> {
  if (!isAiEnabled()) {
    if (opts?.throwOnError) throw new Error("AI is disabled or no API key is configured");
    return null;
  }
  const retries = opts?.retries ?? 2;

  let attempt = 0;
  let lastErr = "";
  while (attempt <= retries) {
    try {
      const out =
        env.ai.provider === "anthropic"
          ? await callAnthropic(messages, opts?.maxTokens)
          : env.ai.provider === "openai"
            ? await callOpenAI(messages, opts?.maxTokens)
            : null;
      if (out !== null) return out;
      lastErr = "empty response";
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      // Retry only transient failures (rate limit / timeout / 5xx).
      if (!/\b(429|500|502|503|504|timeout|aborted|ETIMEDOUT|ECONNRESET)\b/i.test(lastErr)) {
        log.error("AI generation failed (non-retryable)", { err: lastErr });
        if (opts?.throwOnError) throw new Error(lastErr);
        return null;
      }
    }
    attempt++;
    if (attempt <= retries) {
      const backoff = Math.min(1000 * 2 ** attempt, 8000);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  log.error("AI generation failed after retries", { err: lastErr });
  if (opts?.throwOnError) throw new Error(lastErr);
  return null;
}

/** Minimal live health check used by the admin "Test connection" button. */
export async function pingAi(): Promise<{ ok: boolean; provider: string; model: string; error?: string }> {
  const status = aiStatus();
  if (!status.enabled) {
    return { ok: false, provider: status.provider, model: status.model, error: status.configured ? "Provider disabled" : "No API key configured" };
  }
  try {
    const out = await generate(
      [
        { role: "system", content: "You are a health check. Reply with the single word: OK." },
        { role: "user", content: "Reply with OK." },
      ],
      { maxTokens: 16, retries: 0, throwOnError: true }
    );
    if (out && /ok/i.test(out)) return { ok: true, provider: status.provider, model: status.model };
    return { ok: false, provider: status.provider, model: status.model, error: out ? "Unexpected response" : "No response (check key/model)" };
  } catch (err) {
    return { ok: false, provider: status.provider, model: status.model, error: err instanceof Error ? err.message : String(err) };
  }
}

async function callAnthropic(messages: AiMessage[], maxTokens?: number): Promise<string | null> {
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
      max_tokens: maxTokens ?? env.ai.maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    log.error("Anthropic API error", { status: res.status, body });
    throw new Error(`${res.status} ${body}`);
  }
  const json = (await res.json()) as { content?: { text?: string }[] };
  return json.content?.map((c) => c.text ?? "").join("") ?? null;
}

async function callOpenAI(messages: AiMessage[], maxTokens?: number): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: env.ai.model,
      max_tokens: maxTokens ?? env.ai.maxTokens,
      messages,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    log.error("OpenAI API error", { status: res.status, body });
    throw new Error(`${res.status} ${body}`);
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
