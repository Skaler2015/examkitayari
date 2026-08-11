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
import { sanitizeHtml } from "@/lib/sanitize";
import { normalizeUrl, uniqueSlug, titleSimilarity } from "@/lib/utils";
import { writeAudit } from "./audit";

/**
 * Smart Post Publishing Workspace — server actions.
 *
 * The workflow is: Official URL / PDF → Smart Import (analyze) → auto-filled
 * fields → optional "Generate Content" → verify/edit → Save / Publish.
 *
 * Everything here REUSES the existing pipeline (fetchPageText / extractPdfBuffer
 * / classify / extractFor / buildArticleContent / publishArticle). No new DB
 * columns are introduced — posts land in the same Article + typed-record tables
 * the rest of the site already renders.
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

function toDate(v: FormDataEntryValue | null): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string)?.trim();
  return s ? s : null;
}

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
    // arrays/objects (e.g. importantDates) are ignored for the v1 form.
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

// --- 1. Analyze an official URL or PDF ----------------------------------

export type AnalyzeResult = {
  category: ContentCategory;
  confidence: number; // 0..100
  title: string;
  officialUrl: string;
  officialSource: string;
  textPreview: string;
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
      if (!raw || !/^https?:\/\//i.test(raw)) return { error: "Enter a valid http(s) URL of the official notification/page." };
      officialUrl = normalizeUrl(raw) ?? raw;

      if (/\.pdf(\?|$)/i.test(officialUrl)) {
        const pdf = await downloadAndExtractPdf(officialUrl);
        if (!pdf || pdf.text.replace(/\s+/g, "").length < 40)
          return { error: "Couldn't read text from that PDF link. If it's scanned, enable OCR (Admin → AI Provider)." };
        text = pdf.text;
        ocrUsed = pdf.ocrUsed ?? false;
        documentUrls.push(officialUrl);
      } else {
        const page = await fetchPageText(officialUrl);
        if (!page || page.text.replace(/\s+/g, "").length < 60)
          return { error: "Couldn't read enough content from that page. The site may block bots — try uploading the notification PDF instead." };
        text = page.text;
        title = page.title || "";
        documentUrls.push(...page.documentUrls);
      }
    } else if (mode === "pdf") {
      const file = formData.get("file") as File | null;
      if (!file || !file.size) return { error: "Choose a PDF to import." };
      if (file.size > MAX_FILE_BYTES) return { error: "File too large (max 15 MB)." };
      if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf"))
        return { error: "Please upload a PDF file." };
      const buf = Buffer.from(await file.arrayBuffer());
      const pdf = await extractPdfBuffer(buf);
      if (!pdf.text || pdf.text.replace(/\s+/g, "").length < 40)
        return { error: "Couldn't read text from this PDF. If it's scanned, enable OCR (Admin → AI Provider)." };
      text = pdf.text;
      ocrUsed = pdf.ocrUsed ?? false;
      title = (pdf.metadata?.Title as string) || "";
    } else {
      return { error: "Unknown import type." };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to fetch or read the source." };
  }

  const cls = classify(text);
  const data = extractFor(cls.category, text, title || undefined);
  const fields = toFields(data);

  // Best available title: page/pdf title → extracted postName/examName → first line.
  const firstLine = text.split(/[\n.]/).map((s) => s.trim()).find((s) => s.length > 12 && s.length < 160) || "";
  const bestTitle = title || (fields.postName ?? fields.examName ?? "") || firstLine;

  let officialSource = "";
  try {
    if (officialUrl) officialSource = new URL(officialUrl).hostname.replace(/^www\./, "");
  } catch {
    /* ignore */
  }

  await writeAudit("smartpost.analyze", "SourceItem", undefined, {
    mode,
    category: cls.category,
    confidence: cls.score,
    ocrUsed,
  });

  return {
    ok: true,
    result: {
      category: cls.category,
      confidence: Math.round(cls.score * 100),
      title: bestTitle.replace(/\s+/g, " ").trim().slice(0, 200),
      officialUrl,
      officialSource,
      textPreview: text.replace(/\s+/g, " ").trim().slice(0, 1200),
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

/** Pull a URL out of the links list by label keyword (falls back to a named field). */
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

/** Compose full body HTML: the sectioned template + any extra custom links. */
function composeBody(
  category: ContentCategory,
  title: string,
  data: Record<string, unknown>,
  links: Link[],
  officialUrl?: string
): { body: string; importantPoints: string[]; faq: { q: string; a: string }[] } {
  const content = buildArticleContent(category, title, data, officialUrl);
  const known = new Set(
    [data.officialNotificationUrl, data.applyOnlineUrl, data.officialWebsite, data.downloadUrl, data.resultUrl, data.scorecardUrl, data.answerKeyUrl, data.responseSheetUrl, officialUrl]
      .filter((u): u is string => typeof u === "string")
  );
  const extra = links.filter((l) => !known.has(l.url));
  let body = content.body;
  if (extra.length) {
    const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
    const rows = extra
      .map((l) => `<tr><td><strong>${esc(l.label)}</strong></td><td><a href="${esc(l.url)}" rel="nofollow noopener noreferrer" target="_blank">Click Here</a></td></tr>`)
      .join("");
    body += `\n<h2>More Important Links</h2><table><tbody>${rows}</tbody></table>`;
  }
  return { body, importantPoints: content.importantPoints, faq: content.faq };
}

// --- 2. Generate content (fills the editor from structured fields) -------

export type GenerateState = {
  ok?: boolean;
  error?: string;
  body?: string;
  importantPoints?: string[];
  faq?: { q: string; a: string }[];
  shortSummary?: string;
};

export async function generateContent(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  await requirePermission("articles:write");
  const title = str(formData.get("title"));
  if (!title) return { error: "Add a title first, then generate content." };
  const category = asCategory(formData.get("category"));
  const officialUrl = str(formData.get("officialUrl")) ?? undefined;
  const data = readData(formData);
  const links = readLinks(formData);
  const { body, importantPoints, faq } = composeBody(category, title, data, links, officialUrl);
  return {
    ok: true,
    body,
    importantPoints,
    faq,
    shortSummary: `${title} — official details, important dates and direct links.`.slice(0, 240),
  };
}

// --- 3. Create / publish the post ---------------------------------------

export type SaveState = {
  ok?: boolean;
  error?: string;
  articleId?: string;
  slug?: string;
  status?: PublishStatus;
  publicPath?: string;
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
  if (!title) return { error: "Title is required." };

  const category = asCategory(formData.get("category"));
  const officialUrl = str(formData.get("officialUrl"));
  const officialSource = str(formData.get("officialSource")) || (officialUrl ? hostOf(officialUrl) : null) || "Manual (admin)";
  const shortSummary = str(formData.get("shortSummary")) || `${title} — official details, important dates and direct links.`.slice(0, 240);
  const data = readData(formData);
  const links = readLinks(formData);

  // Map link-manager entries onto the typed URL fields when not explicitly set.
  data.applyOnlineUrl = data.applyOnlineUrl ?? linkByKeyword(links, /apply|registration|online\s*form/i);
  data.officialNotificationUrl = data.officialNotificationUrl ?? linkByKeyword(links, /notification|advert|pdf|notice/i) ?? officialUrl;
  data.officialWebsite = data.officialWebsite ?? linkByKeyword(links, /official\s*website|home\s*page/i);
  data.downloadUrl = data.downloadUrl ?? linkByKeyword(links, /admit|hall\s*ticket|call\s*letter|download/i);
  data.resultUrl = data.resultUrl ?? linkByKeyword(links, /result/i);
  data.answerKeyUrl = data.answerKeyUrl ?? linkByKeyword(links, /answer\s*key/i);

  // Duplicate detection (unless the admin already confirmed).
  const forced = formData.get("confirmDuplicate") === "1";
  if (!forced) {
    const recent = await prisma.article.findMany({
      where: { category },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { title: true, slug: true, category: true },
    });
    const dup = recent.find((r) => titleSimilarity(r.title, title) >= 0.82);
    if (dup) return { duplicate: dup, error: `A very similar post already exists: “${dup.title}”. Confirm to publish anyway.` };
  }

  // Body: keep the admin's edited HTML if present; else compose from fields.
  const editedBody = str(formData.get("body"));
  const composed = composeBody(category, title, data, links, officialUrl ?? undefined);
  const body = sanitizeHtml(editedBody || composed.body);
  const importantPoints = composed.importantPoints;
  const faq = composed.faq;

  const source = await getOrCreateManualSource();
  const slug = await uniqueSlug(title, async (s) => (await prisma.article.count({ where: { slug: s } })) > 0);

  // Build the typed record (only for categories that have one).
  const typedIds = await createTypedRecord(category, title, data, source.id, officialUrl);

  // Publish routing.
  let status: PublishStatus = PublishStatus.DRAFT;
  let scheduledFor: Date | null = null;
  if (action === "schedule") {
    scheduledFor = toDate(formData.get("scheduledFor"));
    if (!scheduledFor || scheduledFor.getTime() <= Date.now())
      return { error: "Pick a future date & time to schedule this post." };
    status = PublishStatus.SCHEDULED;
  }

  const article = await prisma.article.create({
    data: {
      slug,
      category,
      title,
      shortSummary,
      body,
      faq: faq as unknown as Prisma.InputJsonValue,
      importantPoints,
      aiGenerated: false,
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
    data: {
      articleId: article.id,
      sourceName: officialSource,
      sourceUrl: officialUrl || "manual",
      isOfficial: Boolean(officialUrl),
    },
  });

  if (action === "publish") {
    await publishArticle(article.id);
  }

  await writeAudit("smartpost.create", "Article", article.id, { action, category, status });
  revalidatePath("/");

  const fresh = await prisma.article.findUnique({ where: { id: article.id }, select: { status: true, slug: true } });
  return {
    ok: true,
    articleId: article.id,
    slug: article.slug,
    status: fresh?.status ?? status,
    publicPath: `/${PATHS[category]}/${article.slug}`,
  };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Create the underlying typed record and return the FK to set on the Article. */
async function createTypedRecord(
  category: ContentCategory,
  title: string,
  d: Record<string, unknown>,
  sourceId: string,
  officialUrl: string | null
): Promise<Record<string, string>> {
  const common = {
    sourceId,
    sourceUrl: officialUrl,
    verificationStatus: VerificationStatus.HUMAN_VERIFIED,
    lastVerifiedAt: new Date(),
  };
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
