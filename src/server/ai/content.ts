import { ContentCategory } from "@prisma/client";
import { generate, parseJsonResponse, type AiMessage } from "./provider";
import { truncate } from "@/lib/utils";

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
 "body": string (clean HTML using <h2>, <p>, <ul>; no <script>),
 "faq": [{"q": string, "a": string}] (3-5 items),
 "importantPoints": string[] (3-6 bullet points)
}
Return ONLY the JSON.`,
    },
  ];
  const raw = await generate(messages);
  const parsed = parseJsonResponse<Omit<GeneratedArticle, "aiGenerated">>(raw);
  if (!parsed || !parsed.body || !parsed.seoTitle) return null;
  return { ...parsed, faq: parsed.faq ?? [], importantPoints: parsed.importantPoints ?? [], aiGenerated: true };
}

// --- Deterministic fallback templating (no AI) --------------------------

function fmtVal(v: unknown): string {
  if (v == null || v === "") return "Not Available in Official Source";
  if (v instanceof Date) return v.toLocaleDateString("en-IN");
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString("en-IN");
  return String(v);
}

function templateArticle(input: {
  category: ContentCategory;
  title: string;
  verifiedData: Record<string, unknown>;
  officialSourceUrl?: string;
}): GeneratedArticle {
  const d = input.verifiedData;
  const rows: [string, unknown][] = Object.entries(d).filter(([, v]) => v != null && v !== "");
  const table = rows.length
    ? `<h2>Key Details</h2><ul>${rows
        .map(([k, v]) => `<li><strong>${humanize(k)}:</strong> ${fmtVal(v)}</li>`)
        .join("")}</ul>`
    : "";

  const body = `
<p>${input.title}. The details below are compiled from the official source. Always confirm on the official website using the link provided.</p>
${table}
<h2>Official Source</h2>
<p>Refer to the official notification/link for authoritative information${
    input.officialSourceUrl ? `: <a href="${input.officialSourceUrl}" rel="nofollow noopener" target="_blank">Official Source</a>` : "."
  }</p>
<p><em>Information status: auto-extracted from the official source and pending human verification. Fields marked "Not Available in Official Source" were not found and are not guessed.</em></p>`.trim();

  const importantPoints = rows.slice(0, 6).map(([k, v]) => `${humanize(k)}: ${fmtVal(v)}`);

  return {
    seoTitle: truncate(input.title, 65),
    metaDescription: truncate(`${input.title} — official details, dates and direct links.`, 160),
    shortSummary: truncate(`${input.title}. Compiled from the official source with direct links.`, 240),
    body,
    faq: buildFaq(input.category, input.title, input.officialSourceUrl),
    importantPoints,
    aiGenerated: false,
  };
}

function buildFaq(category: ContentCategory, title: string, url?: string): { q: string; a: string }[] {
  const officialLine = url ? `Visit the official source: ${url}` : "Check the official website of the organisation.";
  const base = [
    { q: `Where can I find the official information for "${title}"?`, a: officialLine },
    {
      q: "Is the information on this page official?",
      a: "This page compiles information from the official source and links to it. Always verify final details on the official website.",
    },
  ];
  if (category === ContentCategory.JOB)
    base.push({ q: "How do I apply?", a: "Use the official apply-online link once available and read the full notification before applying." });
  if (category === ContentCategory.ADMIT_CARD)
    base.push({ q: "How do I download my admit card?", a: "Use the official download link, enter your registration details, and print the admit card." });
  if (category === ContentCategory.RESULT)
    base.push({ q: "How do I check my result?", a: "Open the official result link and enter your roll number / registration details." });
  return base;
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/Url/g, "URL")
    .trim();
}
