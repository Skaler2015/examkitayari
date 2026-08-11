"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/rbac";
import {
  ContentCategory,
  PublishStatus,
  VerificationStatus,
  SourceType,
  Prisma,
} from "@prisma/client";
import { fetchPageText } from "@/server/crawler/html";
import { downloadAndExtractPdf, extractPdfBuffer } from "@/server/crawler/pdf";
import { classify } from "@/server/pipeline/classify";
import { extractFor } from "@/server/pipeline/extract";
import { buildArticleContent } from "@/server/templates/article";
import { publishArticle } from "@/server/pipeline/publish";
import { generate, parseJsonResponse, isAiEnabled } from "@/server/ai/provider";
import { generateArticle } from "@/server/ai/content";
import { sanitizeHtml } from "@/lib/sanitize";
import { normalizeUrl, uniqueSlug, titleSimilarity } from "@/lib/utils";
import { writeAudit } from "./audit";

/**
 * Smart Post Publishing Workspace — server actions.
 *
 * Workflow: Official URL / PDF → Smart Import (analyze) → AI reads the source
 * and auto-fills the fields → optional "AI se poori post likho" → verify/edit →
 * Save / Publish.
 *
 * Reuses the existing pipeline (fetchPageText / extractPdfBuffer / classify /
 * extractFor / buildArticleContent / generateArticle / publishArticle). When AI
 * is enabled it EXTRACTS fields from (and writes prose grounded in) the actual
 * source text — it never invents facts. No new DB columns are introduced.
 */

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const CATEGORY_VALUES = Object.values(ContentCategory) as string[];

function asCategory(raw: unknown, fallback: ContentCategory = ContentCategory.OTHER): ContentCategory {
  return typeof raw === "string" && CATEGORY_VALUES.includes(raw) ? (raw as ContentCategory) : fallback;
}

/** Date → yyyy-mm-dd for <input type="date">. */
function dateInput(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Parse loose date strings (ISO / dd-mm-yyyy / "15 August 2026") → yyyy-mm-dd. */
function parseLooseDate(input: unknown): string {
  if (!input) return "";
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(year, Number(m) - 1, Number(d));
    if (!isNaN(dt.getTime())) return dateInput(dt);
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? "" : dateInput(dt);
}

function toDate(v: FormDataEntryValue | null): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string)?.trim();
  return s ? s : null;
}

const DATE_KEYS = new Set(["applicationStart", "applicationEnd", "examDate", "releaseDate", "objectionStart", "objectionEnd"]);

/** Flatten extractor output into string values the client form can consume. */
function toFields(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null || v === "") continue;
    if (v instanceof Date) {
      const s = dateInput(v);
      if (s) out[k] = s;
    } else if (typeof v === "number") {
      out[k] = String(v);
    } else if (typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}

async function getOrCreateManualSource() {
  const monitorUrl = "https://examskitayari.com/manual";
  const existing = await prisma.source.findFirst({ where: { monitorUrl } });
  if (existing) return existing;
  return prisma.source.create({
    data: { name: "Manual Entry", monitorUrl, type: SourceType.HTML_PAGE, isActive: false, frequencyMinutes: 1440 },
  });
}

// --- AI field extraction (grounded, no guessing) ------------------------

const AI_FIELDS: Record<string, { key: string; desc: string }[]> = {
  JOB: [
    { key: "title", desc: "a clear post headline, e.g. 'SBI PO 2026 Notification: 2000 Posts'" },
    { key: "organization", desc: "recruiting organisation / department" },
    { key: "recruitmentName", desc: "official recruitment/advertisement name" },
    { key: "postName", desc: "post name(s) being recruited" },
    { key: "vacancyCount", desc: "total number of vacancies (integer only)" },
    { key: "vacancyDetail", desc: "post/category-wise vacancy break-up" },
    { key: "applicationStart", desc: "online application start date" },
    { key: "applicationEnd", desc: "last date to apply" },
    { key: "examDate", desc: "exam/written test date" },
    { key: "applicationFee", desc: "application fee by category" },
    { key: "salary", desc: "salary / pay scale" },
    { key: "qualification", desc: "educational qualification required" },
    { key: "ageLimit", desc: "age limit, e.g. 21-30 years" },
    { key: "ageRelaxation", desc: "age relaxation by category" },
    { key: "selectionProcess", desc: "stages of selection" },
    { key: "importantInstructions", desc: "any important instructions to candidates" },
    { key: "officialNotificationUrl", desc: "URL of the official notification PDF" },
    { key: "applyOnlineUrl", desc: "URL to apply online" },
    { key: "officialWebsite", desc: "official website URL" },
  ],
  ADMIT_CARD: [
    { key: "title", desc: "a clear headline" },
    { key: "examName", desc: "exam name" },
    { key: "post", desc: "post name" },
    { key: "releaseDate", desc: "admit card release date" },
    { key: "examDate", desc: "exam date" },
    { key: "examShift", desc: "exam shift / timing" },
    { key: "examCityInfo", desc: "exam city / centre info" },
    { key: "downloadUrl", desc: "admit card download URL" },
  ],
  RESULT: [
    { key: "title", desc: "a clear headline" },
    { key: "examName", desc: "exam name" },
    { key: "releaseDate", desc: "result declaration date" },
    { key: "resultType", desc: "result type e.g. Final / Tier-I" },
    { key: "resultUrl", desc: "check result URL" },
    { key: "scorecardUrl", desc: "scorecard download URL" },
  ],
  ANSWER_KEY: [
    { key: "title", desc: "a clear headline" },
    { key: "examName", desc: "exam name" },
    { key: "examDate", desc: "exam date" },
    { key: "keyType", desc: "Provisional or Final" },
    { key: "objectionStart", desc: "objection window start date" },
    { key: "objectionEnd", desc: "objection window end date" },
    { key: "answerKeyUrl", desc: "answer key URL" },
    { key: "responseSheetUrl", desc: "response sheet URL" },
  ],
};

async function aiExtractFields(category: ContentCategory, text: string): Promise<Record<string, string>> {
  const descriptors = AI_FIELDS[category] ?? AI_FIELDS.JOB;
  const schema = descriptors.map((f) => `  "${f.key}": ${f.desc}`).join(",\n");
  const raw = await generate(
    [
      {
        role: "system",
        content:
          "You extract structured facts from official Indian government exam / recruitment notifications. " +
          "Use ONLY information explicitly present in the SOURCE TEXT. Never guess, infer, or fabricate. " +
          "If a field is not clearly stated, set it to null. Dates MUST be in YYYY-MM-DD format. " +
          "vacancyCount must be an integer. Return ONLY a JSON object, no prose.",
      },
      {
        role: "user",
        content: `Extract these fields as JSON:\n{\n${schema}\n}\n\nSOURCE TEXT:\n${text.slice(0, 9000)}`,
      },
    ],
    { maxTokens: 1500 }
  );
  const parsed = parseJsonResponse<Record<string, unknown>>(raw);
  if (!parsed) return {};
  const out: Record<string, string> = {};
  for (const { key } of descriptors) {
    const v = parsed[key];
    if (v == null || v === "" || v === "null" || v === "N/A") continue;
    if (DATE_KEYS.has(key)) {
      const d = parseLooseDate(v);
      if (d) out[key] = d;
    } else if (key === "vacancyCount") {
      const n = Number(String(v).replace(/[,\s]/g, ""));
      if (Number.isFinite(n) && n > 0) out[key] = String(n);
    } else {
      out[key] = String(v).replace(/\s+/g, " ").trim().slice(0, 2000);
    }
  }
  return out;
}

// --- 1. Analyze an official URL or PDF ----------------------------------

export type AnalyzeResult = {
  category: ContentCategory;
  confidence: number;
  aiUsed: boolean;
  title: string;
  officialUrl: string;
  officialSource: string;
  textPreview: string;
  sourceText: string;
  fields: Record<string, string>;
  documentUrls: string[];
  ocrUsed?: boolean;
};

export type AnalyzeState = { ok?: boolean; error?: string; result?: AnalyzeResult };

export async function analyzeSource(_prev: AnalyzeState, formData: FormData): Promise<AnalyzeState> {
  await requirePermission("articles:write");

  const mode = String(formData.get("mode") || "url");
  let text = "";
  let title = "";
  let officialUrl = "";
  const documentUrls: string[] = [];
  let ocrUsed = false;

  try {
    if (mode === "url") {
      const raw = str(formData.get("url"));
      if (!raw || !/^https?:\/\//i.test(raw)) return { error: "Poora official notification/page ka URL daalein (https:// se shuru)." };
      officialUrl = normalizeUrl(raw) ?? raw;

      if (/\.pdf(\?|$)/i.test(officialUrl)) {
        const pdf = await downloadAndExtractPdf(officialUrl);
        if (!pdf || pdf.text.replace(/\s+/g, "").length < 40)
          return { error: "Is PDF link se text nahi padha ja saka. Agar scanned hai to OCR enable karein (Admin → AI Provider)." };
        text = pdf.text;
        ocrUsed = pdf.ocrUsed ?? false;
        documentUrls.push(officialUrl);
      } else {
        const page = await fetchPageText(officialUrl);
        if (!page || page.text.replace(/\s+/g, "").length < 60)
          return { error: "Is page se content nahi padha ja saka. Site bots block kar rahi ho sakti hai — notification ki PDF upload karke dekhein." };
        text = page.text;
        title = page.title || "";
        documentUrls.push(...page.documentUrls);
      }
    } else if (mode === "pdf") {
      const file = formData.get("file") as File | null;
      if (!file || !file.size) return { error: "Import karne ke liye ek PDF chunein." };
      if (file.size > MAX_FILE_BYTES) return { error: "File bahut badi hai (max 15 MB)." };
      if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf"))
        return { error: "Kripya PDF file upload karein." };
      const buf = Buffer.from(await file.arrayBuffer());
      const pdf = await extractPdfBuffer(buf);
      if (!pdf.text || pdf.text.replace(/\s+/g, "").length < 40)
        return { error: "Is PDF se text nahi padha ja saka. Agar scanned hai to OCR enable karein (Admin → AI Provider)." };
      text = pdf.text;
      ocrUsed = pdf.ocrUsed ?? false;
      title = (pdf.metadata?.Title as string) || "";
    } else {
      return { error: "Unknown import type." };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Source fetch/read fail ho gaya." };
  }

  const cls = classify(text);

  // Rule-based first (always), then AI on top (grounded) when available.
  const ruleFields = toFields(extractFor(cls.category, text, title || undefined));
  let aiFields: Record<string, string> = {};
  let aiUsed = false;
  if (isAiEnabled()) {
    try {
      aiFields = await aiExtractFields(cls.category, text);
      aiUsed = Object.keys(aiFields).length > 0;
    } catch {
      aiUsed = false;
    }
  }
  const fields = { ...ruleFields, ...aiFields }; // AI takes precedence where present

  const firstLine = text.split(/[\n.]/).map((s) => s.trim()).find((s) => s.length > 12 && s.length < 160) || "";
  const bestTitle = fields.title || title || fields.postName || fields.examName || firstLine;
  delete fields.title;

  let officialSource = "";
  try {
    if (officialUrl) officialSource = new URL(officialUrl).hostname.replace(/^www\./, "");
  } catch {
    /* ignore */
  }

  await writeAudit("smartpost.analyze", "SourceItem", undefined, { mode, category: cls.category, confidence: cls.score, aiUsed, ocrUsed });

  return {
    ok: true,
    result: {
      category: cls.category,
      confidence: Math.round(cls.score * 100),
      aiUsed,
      title: bestTitle.replace(/\s+/g, " ").trim().slice(0, 200),
      officialUrl,
      officialSource,
      textPreview: text.replace(/\s+/g, " ").trim().slice(0, 1200),
      sourceText: text.replace(/\s+/g, " ").trim().slice(0, 8000),
      fields,
      documentUrls: [...new Set(documentUrls)].slice(0, 10),
      ocrUsed,
    },
  };
}

// --- shared: read the workspace form into a data object -----------------

type Link = { label: string; url: string };

function readLinks(formData: FormData): Link[] {
  const raw = formData.get("links");
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((l) => ({ label: String((l as Link)?.label ?? "").trim(), url: String((l as Link)?.url ?? "").trim() }))
      .filter((l) => l.label && /^https?:\/\//i.test(l.url));
  } catch {
    return [];
  }
}

function linkByKeyword(links: Link[], keywords: RegExp): string | null {
  const hit = links.find((l) => keywords.test(l.label));
  return hit ? hit.url : null;
}

function readData(formData: FormData): Record<string, unknown> {
  const vacancyRaw = str(formData.get("vacancyCount"));
  const vacancyCount = vacancyRaw ? Number(vacancyRaw.replace(/[,\s]/g, "")) : null;
  return {
    organization: str(formData.get("organization")),
    recruitmentName: str(formData.get("recruitmentName")),
    postName: str(formData.get("postName")),
    vacancyCount: Number.isFinite(vacancyCount as number) ? vacancyCount : null,
    vacancyDetail: str(formData.get("vacancyDetail")),
    qualification: str(formData.get("qualification")),
    ageLimit: str(formData.get("ageLimit")),
    ageRelaxation: str(formData.get("ageRelaxation")),
    applicationStart: toDate(formData.get("applicationStart")),
    applicationEnd: toDate(formData.get("applicationEnd")),
    applicationFee: str(formData.get("applicationFee")),
    salary: str(formData.get("salary")),
    selectionProcess: str(formData.get("selectionProcess")),
    examDate: toDate(formData.get("examDate")),
    releaseDate: toDate(formData.get("releaseDate")),
    resultType: str(formData.get("resultType")),
    keyType: str(formData.get("keyType")),
    objectionStart: toDate(formData.get("objectionStart")),
    objectionEnd: toDate(formData.get("objectionEnd")),
    examName: str(formData.get("examName")),
    post: str(formData.get("post")),
    examShift: str(formData.get("examShift")),
    examCityInfo: str(formData.get("examCityInfo")),
    importantInstructions: str(formData.get("importantInstructions")),
    additionalInfo: str(formData.get("additionalInfo")),
    officialNotificationUrl: str(formData.get("officialNotificationUrl")),
    applyOnlineUrl: str(formData.get("applyOnlineUrl")),
    officialWebsite: str(formData.get("officialWebsite")),
    downloadUrl: str(formData.get("downloadUrl")),
    resultUrl: str(formData.get("resultUrl")),
    scorecardUrl: str(formData.get("scorecardUrl")),
    answerKeyUrl: str(formData.get("answerKeyUrl")),
    responseSheetUrl: str(formData.get("responseSheetUrl")),
    fileUrl: str(formData.get("fileUrl")),
  };
}

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

function extraLinksTable(links: Link[], data: Record<string, unknown>, officialUrl?: string): string {
  const known = new Set(
    [data.officialNotificationUrl, data.applyOnlineUrl, data.officialWebsite, data.downloadUrl, data.resultUrl, data.scorecardUrl, data.answerKeyUrl, data.responseSheetUrl, officialUrl]
      .filter((u): u is string => typeof u === "string")
  );
  const extra = links.filter((l) => !known.has(l.url));
  if (!extra.length) return "";
  const rows = extra
    .map((l) => `<tr><td><strong>${esc(l.label)}</strong></td><td><a href="${esc(l.url)}" rel="nofollow noopener noreferrer" target="_blank">Click Here</a></td></tr>`)
    .join("");
  return `\n<h2>More Important Links</h2><table><tbody>${rows}</tbody></table>`;
}

type Composed = { body: string; importantPoints: string[]; faq: { q: string; a: string }[]; shortSummary: string; aiUsed: boolean };

/** Compose the full post — AI-written when enabled, deterministic template otherwise. */
async function composePost(
  category: ContentCategory,
  title: string,
  data: Record<string, unknown>,
  links: Link[],
  officialUrl?: string,
  sourceText?: string
): Promise<Composed> {
  const additional = typeof data.additionalInfo === "string" && data.additionalInfo.trim()
    ? `<h2>Additional Information</h2><p>${esc(data.additionalInfo)}</p>`
    : "";

  if (isAiEnabled()) {
    try {
      const art = await generateArticle({ category, title, sourceText: sourceText || "", verifiedData: data, officialSourceUrl: officialUrl });
      if (art.aiGenerated && art.body) {
        return {
          body: art.body + additional + extraLinksTable(links, data, officialUrl),
          importantPoints: art.importantPoints,
          faq: art.faq,
          shortSummary: art.shortSummary || `${title} — official details, important dates and direct links.`.slice(0, 240),
          aiUsed: true,
        };
      }
    } catch {
      /* fall through to template */
    }
  }

  const content = buildArticleContent(category, title, data, officialUrl);
  return {
    body: content.body + additional + extraLinksTable(links, data, officialUrl),
    importantPoints: content.importantPoints,
    faq: content.faq,
    shortSummary: `${title} — official details, important dates and direct links.`.slice(0, 240),
    aiUsed: false,
  };
}

// --- 2. Generate content (AI writes the full post) ----------------------

export type GenerateState = {
  ok?: boolean;
  error?: string;
  aiUsed?: boolean;
  body?: string;
  importantPoints?: string[];
  faq?: { q: string; a: string }[];
  shortSummary?: string;
};

export async function generateContent(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  await requirePermission("articles:write");
  const title = str(formData.get("title"));
  if (!title) return { error: "Pehle title daalein, phir content generate karein." };
  const category = asCategory(formData.get("category"));
  const officialUrl = str(formData.get("officialUrl")) ?? undefined;
  const sourceText = str(formData.get("sourceText")) ?? undefined;
  const data = readData(formData);
  const links = readLinks(formData);
  const c = await composePost(category, title, data, links, officialUrl, sourceText);
  return { ok: true, aiUsed: c.aiUsed, body: c.body, importantPoints: c.importantPoints, faq: c.faq, shortSummary: c.shortSummary };
}

// --- 3. Create / publish the post ---------------------------------------

export type SaveState = {
  ok?: boolean;
  error?: string;
  articleId?: string;
  slug?: string;
  status?: PublishStatus;
  publicPath?: string;
  aiUsed?: boolean;
  duplicate?: { title: string; slug: string; category: ContentCategory };
};

const PATHS: Record<ContentCategory, string> = {
  JOB: "jobs",
  ADMIT_CARD: "admit-card",
  RESULT: "results",
  ANSWER_KEY: "answer-key",
  EXAM_DATE: "exam-dates",
  CUTOFF: "cutoffs",
  MERIT_LIST: "merit-list",
  NOTICE: "notices",
  SYLLABUS: "syllabus",
  EXAM_PATTERN: "exam-pattern",
  COUNSELLING: "counselling",
  DOCUMENT_VERIFICATION: "document-verification",
  CURRENT_AFFAIRS: "current-affairs",
  OTHER: "updates",
};

export async function createSmartPost(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const action = String(formData.get("action") || "draft"); // draft | publish | schedule
  const needsPublish = action === "publish" || action === "schedule";
  await requirePermission(needsPublish ? "articles:publish" : "articles:write");

  const title = str(formData.get("title"));
  if (!title) return { error: "Title zaroori hai." };

  const category = asCategory(formData.get("category"));
  const officialUrl = str(formData.get("officialUrl"));
  const sourceText = str(formData.get("sourceText")) ?? undefined;
  const officialSource = str(formData.get("officialSource")) || (officialUrl ? hostOf(officialUrl) : null) || "Manual (admin)";
  const data = readData(formData);
  const links = readLinks(formData);

  // Map link-manager entries onto typed URL fields when not explicitly set.
  data.applyOnlineUrl = data.applyOnlineUrl ?? linkByKeyword(links, /apply|registration|online\s*form/i);
  data.officialNotificationUrl = data.officialNotificationUrl ?? linkByKeyword(links, /notification|advert|pdf|notice/i) ?? officialUrl;
  data.officialWebsite = data.officialWebsite ?? linkByKeyword(links, /official\s*website|home\s*page/i);
  data.downloadUrl = data.downloadUrl ?? linkByKeyword(links, /admit|hall\s*ticket|call\s*letter|download/i);
  data.resultUrl = data.resultUrl ?? linkByKeyword(links, /result/i);
  data.answerKeyUrl = data.answerKeyUrl ?? linkByKeyword(links, /answer\s*key/i);

  const forced = formData.get("confirmDuplicate") === "1";
  if (!forced) {
    const recent = await prisma.article.findMany({
      where: { category },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { title: true, slug: true, category: true },
    });
    const dup = recent.find((r) => titleSimilarity(r.title, title) >= 0.82);
    if (dup) return { duplicate: dup, error: `Milti-julti post pehle se hai: “${dup.title}”. Confirm karein to phir bhi publish hoga.` };
  }

  // Body: keep the admin's edited HTML; else compose (AI or template).
  const editedBody = str(formData.get("body"));
  let bodyHtml: string;
  let importantPoints: string[];
  let faq: { q: string; a: string }[];
  let shortSummary = str(formData.get("shortSummary"));
  let aiUsed = false;
  if (editedBody) {
    const c = await composePost(category, title, data, links, officialUrl ?? undefined, sourceText);
    bodyHtml = editedBody;
    importantPoints = c.importantPoints;
    faq = c.faq;
    if (!shortSummary) shortSummary = c.shortSummary;
  } else {
    const c = await composePost(category, title, data, links, officialUrl ?? undefined, sourceText);
    bodyHtml = c.body;
    importantPoints = c.importantPoints;
    faq = c.faq;
    aiUsed = c.aiUsed;
    if (!shortSummary) shortSummary = c.shortSummary;
  }
  const body = sanitizeHtml(bodyHtml);

  const source = await getOrCreateManualSource();
  const slug = await uniqueSlug(title, async (s) => (await prisma.article.count({ where: { slug: s } })) > 0);
  const typedIds = await createTypedRecord(category, title, data, source.id, officialUrl);

  let status: PublishStatus = PublishStatus.DRAFT;
  let scheduledFor: Date | null = null;
  if (action === "schedule") {
    scheduledFor = toDate(formData.get("scheduledFor"));
    if (!scheduledFor || scheduledFor.getTime() <= Date.now())
      return { error: "Schedule ke liye ek future date & time chunein." };
    status = PublishStatus.SCHEDULED;
  }

  const article = await prisma.article.create({
    data: {
      slug,
      category,
      title,
      shortSummary: shortSummary || `${title} — official details, important dates and direct links.`.slice(0, 240),
      body,
      faq: faq as unknown as Prisma.InputJsonValue,
      importantPoints,
      aiGenerated: aiUsed,
      officialSource,
      officialSourceUrl: officialUrl,
      verificationStatus: VerificationStatus.HUMAN_VERIFIED,
      lastVerifiedAt: new Date(),
      status,
      scheduledFor,
      ...typedIds,
    },
  });

  await prisma.articleSource.create({
    data: { articleId: article.id, sourceName: officialSource, sourceUrl: officialUrl || "manual", isOfficial: Boolean(officialUrl) },
  });

  if (action === "publish") await publishArticle(article.id);

  await writeAudit("smartpost.create", "Article", article.id, { action, category, status, aiUsed });
  revalidatePath("/");

  const fresh = await prisma.article.findUnique({ where: { id: article.id }, select: { status: true } });
  return {
    ok: true,
    articleId: article.id,
    slug: article.slug,
    status: fresh?.status ?? status,
    publicPath: `/${PATHS[category]}/${article.slug}`,
    aiUsed,
  };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function createTypedRecord(
  category: ContentCategory,
  title: string,
  d: Record<string, unknown>,
  sourceId: string,
  officialUrl: string | null
): Promise<Record<string, string>> {
  const common = { sourceId, sourceUrl: officialUrl, verificationStatus: VerificationStatus.HUMAN_VERIFIED, lastVerifiedAt: new Date() };
  const slugFor = (count: (s: string) => Promise<boolean>) => uniqueSlug(title, count);

  switch (category) {
    case ContentCategory.JOB: {
      const job = await prisma.job.create({
        data: {
          slug: await slugFor(async (s) => (await prisma.job.count({ where: { slug: s } })) > 0),
          title,
          recruitmentName: d.recruitmentName as string | null,
          postName: d.postName as string | null,
          vacancyCount: d.vacancyCount as number | null,
          vacancyDetail: d.vacancyDetail as string | null,
          qualification: d.qualification as string | null,
          ageLimit: d.ageLimit as string | null,
          ageRelaxation: d.ageRelaxation as string | null,
          applicationStart: d.applicationStart as Date | null,
          applicationEnd: d.applicationEnd as Date | null,
          applicationFee: d.applicationFee as string | null,
          salary: d.salary as string | null,
          selectionProcess: d.selectionProcess as string | null,
          examDate: d.examDate as Date | null,
          importantInstructions: d.importantInstructions as string | null,
          applyOnlineUrl: d.applyOnlineUrl as string | null,
          officialNotificationUrl: d.officialNotificationUrl as string | null,
          officialWebsite: d.officialWebsite as string | null,
          ...common,
        },
      });
      return { jobId: job.id };
    }
    case ContentCategory.ADMIT_CARD: {
      const rec = await prisma.admitCard.create({
        data: {
          slug: await slugFor(async (s) => (await prisma.admitCard.count({ where: { slug: s } })) > 0),
          title,
          examName: d.examName as string | null,
          post: d.post as string | null,
          releaseDate: d.releaseDate as Date | null,
          examDate: d.examDate as Date | null,
          examShift: d.examShift as string | null,
          examCityInfo: d.examCityInfo as string | null,
          downloadUrl: d.downloadUrl as string | null,
          ...common,
        },
      });
      return { admitCardId: rec.id };
    }
    case ContentCategory.RESULT: {
      const rec = await prisma.result.create({
        data: {
          slug: await slugFor(async (s) => (await prisma.result.count({ where: { slug: s } })) > 0),
          title,
          examName: d.examName as string | null,
          releaseDate: d.releaseDate as Date | null,
          resultType: d.resultType as string | null,
          resultUrl: d.resultUrl as string | null,
          scorecardUrl: d.scorecardUrl as string | null,
          ...common,
        },
      });
      return { resultId: rec.id };
    }
    case ContentCategory.ANSWER_KEY: {
      const rec = await prisma.answerKey.create({
        data: {
          slug: await slugFor(async (s) => (await prisma.answerKey.count({ where: { slug: s } })) > 0),
          title,
          examName: d.examName as string | null,
          examDate: d.examDate as Date | null,
          keyType: d.keyType as string | null,
          isFinal: /final/i.test(String(d.keyType ?? "")),
          objectionStart: d.objectionStart as Date | null,
          objectionEnd: d.objectionEnd as Date | null,
          answerKeyUrl: d.answerKeyUrl as string | null,
          responseSheetUrl: d.responseSheetUrl as string | null,
          ...common,
        },
      });
      return { answerKeyId: rec.id };
    }
    case ContentCategory.NOTICE: {
      const rec = await prisma.notice.create({
        data: {
          slug: await slugFor(async (s) => (await prisma.notice.count({ where: { slug: s } })) > 0),
          title,
          fileUrl: (d.fileUrl as string | null) ?? officialUrl,
          ...common,
        },
      });
      return { noticeId: rec.id };
    }
    default:
      return {};
  }
}
