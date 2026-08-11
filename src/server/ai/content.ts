import { ContentCategory } from "@prisma/client";
import { generate, parseJsonResponse, type AiMessage } from "./provider";
import { truncate } from "@/lib/utils";
import { buildArticleContent } from "@/server/templates/article";

const GUARDRAILS = `You are an editorial assistant for an Indian competitive-exam news portal.
STRICT RULES:
- You may ONLY use facts present in the provided VERIFIED DATA and SOURCE TEXT.
- NEVER invent vacancies, dates, eligibility, fees, official links, or results.
- If a fact is not present, omit it or write "Not Available in Official Source".
- Do not claim anything is "official" beyond what the source states.
- Write in clear, simple English aimed at Indian aspirants.`;

export type GeneratedArticle = {
  seoTitle: string;
  metaDescription: string;
  shortSummary: string;
  body: string; // HTML
  faq: { q: string; a: string }[];
  importantPoints: string[];
  aiGenerated: boolean;
};

/**
 * Generate an article draft. Uses AI when configured; otherwise falls back to a
 * deterministic template built purely from verified extracted fields.
 */
export async function generateArticle(input: {
  category: ContentCategory;
  title: string;
  sourceText: string;
  verifiedData: Record<string, unknown>;
  officialSourceUrl?: string;
}): Promise<GeneratedArticle> {
  const ai = await tryAi(input);
  if (ai) return ai;
  return templateArticle(input);
}

async function tryAi(input: {
  category: ContentCategory;
  title: string;
  sourceText: string;
  verifiedData: Record<string, unknown>;
  officialSourceUrl?: string;
}): Promise<GeneratedArticle | null> {
  const messages: AiMessage[] = [
    { role: "system", content: GUARDRAILS },
    {
      role: "user",
      content: `Category: ${input.category}
Title: ${input.title}
Official Source URL: ${input.officialSourceUrl ?? "N/A"}

VERIFIED DATA (the only factual source you may use):
${JSON.stringify(input.verifiedData, null, 2)}

SOURCE TEXT (excerpt):
${truncate(input.sourceText, 4000)}

Produce a JSON object with keys:
{
 "seoTitle": string (<= 65 chars),
 "metaDescription": string (<= 160 chars),
 "shortSummary": string (2-3 sentences),
 "body": string (clean HTML, no <script>),
 "faq": [{"q": string, "a": string}] (3-5 items),
 "importantPoints": string[] (3-6 bullet points)
}
For "body", write a DETAILED, well-structured post using <h2> section headings and
<table> for tabular data. Include (only the sections supported by the data):
Overview, Important Dates (table), Application Fee, Vacancy Details, Eligibility,
Age Limit, Salary, Selection Process, How to Apply (steps as <ul>), Important
Links (table of official links), and Important Instructions. Use official links
with rel="nofollow noopener". For any field not present in VERIFIED DATA, write
"Not Available in Official Source" — never guess.
Return ONLY the JSON.`,
    },
  ];
  const raw = await generate(messages);
  const parsed = parseJsonResponse<Omit<GeneratedArticle, "aiGenerated">>(raw);
  if (!parsed || !parsed.body || !parsed.seoTitle) return null;
  return { ...parsed, faq: parsed.faq ?? [], importantPoints: parsed.importantPoints ?? [], aiGenerated: true };
}

// --- Deterministic fallback templating (no AI) --------------------------

function templateArticle(input: {
  category: ContentCategory;
  title: string;
  verifiedData: Record<string, unknown>;
  officialSourceUrl?: string;
}): GeneratedArticle {
  // Rich, sectioned body + FAQ + highlights from the verified structured data.
  const content = buildArticleContent(input.category, input.title, input.verifiedData, input.officialSourceUrl);

  return {
    seoTitle: truncate(input.title, 65),
    metaDescription: truncate(`${input.title} — official details, important dates and direct links.`, 160),
    shortSummary: truncate(`${input.title}. Compiled from the official source with important dates and direct official links.`, 240),
    body: content.body,
    faq: content.faq,
    importantPoints: content.importantPoints,
    aiGenerated: false,
  };
}

