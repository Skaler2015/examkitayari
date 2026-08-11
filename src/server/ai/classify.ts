import { ContentCategory } from "@prisma/client";
import { generate, parseJsonResponse, isAiEnabled, type AiMessage } from "./provider";
import { truncate } from "@/lib/utils";

const CATEGORIES = Object.values(ContentCategory);

/**
 * Secondary AI classification layer. Used only to REFINE a low-confidence
 * rule-based result — never to fabricate content. Returns null when AI is
 * disabled or the response is unusable, so the caller keeps the rule result.
 */
export async function classifyWithAi(text: string): Promise<{ category: ContentCategory; score: number } | null> {
  if (!isAiEnabled()) return null;

  const messages: AiMessage[] = [
    {
      role: "system",
      content:
        "You classify Indian government exam/recruitment notices into exactly one category. " +
        "Respond with STRICT JSON only. Do not invent facts.",
    },
    {
      role: "user",
      content: `Classify the following into one category from this list:
${CATEGORIES.join(", ")}

TEXT:
${truncate(text, 2500)}

Return ONLY: {"category": "<ONE_OF_THE_LIST>", "confidence": <0..1>}`,
    },
  ];

  const raw = await generate(messages, { maxTokens: 64, retries: 1 });
  const parsed = parseJsonResponse<{ category: string; confidence: number }>(raw);
  if (!parsed) return null;

  const category = CATEGORIES.find((c) => c === parsed.category);
  if (!category) return null;
  const score = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.6;
  return { category, score };
}
