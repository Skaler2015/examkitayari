import {
  ContentCategory,
  ProcessingStage,
  VerificationStatus,
  PublishStatus,
  Prisma,
  type SourceItem,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { uniqueSlug } from "@/lib/utils";
import { fetchPageText } from "@/server/crawler/html";
import { downloadAndExtractPdf } from "@/server/crawler/pdf";
import { classify } from "./classify";
import { classifyWithAi } from "@/server/ai/classify";
import { computeQualityScore } from "./scoring";
import { computeSourceReliability } from "./reliability";
import { validateExtraction } from "@/server/ai/validate";
import { sanitizeHtml } from "@/lib/sanitize";
import { extractFor } from "./extract";
import { findDuplicate } from "./dedupe";
import { generateArticle } from "@/server/ai/content";
import { getEffectiveSettings } from "@/server/automation/settings";
import { publishArticle } from "./publish";

const log = logger.child("pipeline");

/**
 * Full pipeline for a single discovered SourceItem:
 * FETCH → PARSE → CLASSIFY → EXTRACT → DEDUPE → AI DRAFT → VALIDATE →
 * (AUTO-PUBLISH | PENDING REVIEW).
 * Returns the resulting stage.
 */
export async function processSourceItem(itemId: string): Promise<ProcessingStage> {
  const item = await prisma.sourceItem.findUnique({
    where: { id: itemId },
    include: { source: true },
  });
  if (!item) return ProcessingStage.FAILED;

  try {
    // 1. FETCH full content (if we only have a link).
    const { text, title, documentId } = await gatherContent(item);
    const fullText = `${item.title ?? ""}\n${title}\n${text}`.trim();

    await prisma.sourceItem.update({
      where: { id: item.id },
      data: { stage: ProcessingStage.FETCHED, rawContent: text.slice(0, 50000), documentId },
    });

    // 2. CLASSIFY — rule-based first, then an optional AI refinement layer
    //    that only kicks in when the rule result is low-confidence.
    const settings0 = await getEffectiveSettings();
    let cls: { category: ContentCategory; score: number } = settings0.autoClassification
      ? classify(fullText)
      : { category: ContentCategory.OTHER, score: 0 };

    if (settings0.autoClassification && settings0.aiProcessing && cls.score < 0.5) {
      const aiCls = await classifyWithAi(fullText);
      if (aiCls && aiCls.score >= cls.score) {
        cls = aiCls;
        log.info("AI refined classification", { item: item.url, category: aiCls.category, score: aiCls.score });
      }
    }

    await prisma.sourceItem.update({
      where: { id: item.id },
      data: {
        stage: ProcessingStage.CLASSIFIED,
        category: cls.category,
        categoryScore: cls.score,
      },
    });

    // 3. EXTRACT structured data.
    const extracted = extractFor(cls.category, fullText, item.title ?? title);
    await prisma.sourceItem.update({
      where: { id: item.id },
      data: { stage: ProcessingStage.EXTRACTED, extractedData: extracted as Prisma.InputJsonValue, verification: VerificationStatus.AUTO_EXTRACTED },
    });

    // 4. DEDUPE.
    const refreshed = await prisma.sourceItem.findUnique({ where: { id: item.id } });
    const dup = await findDuplicate(refreshed as SourceItem);
    if (dup.isDuplicate && dup.existingItemId) {
      await prisma.sourceItem.update({
        where: { id: item.id },
        data: { stage: ProcessingStage.DUPLICATE },
      });
      log.info("Duplicate detected", { item: item.url, reason: dup.reason });
      return ProcessingStage.DUPLICATE;
    }
    await prisma.sourceItem.update({ where: { id: item.id }, data: { stage: ProcessingStage.DEDUPED } });

    // 5. Source reliability + AI validation (Agent 3) + quality score.
    const settings = await getEffectiveSettings(cls.category);
    const reliability = await computeSourceReliability(item.sourceId);
    const aiVal = settings.aiProcessing ? await validateExtraction(cls.category, fullText, extracted) : null;
    const hasConflict = aiVal ? aiVal.supported === false || aiVal.conflicts.length > 0 : false;

    const quality = computeQualityScore({
      category: cls.category,
      data: extracted,
      sourceReliability: reliability,
      categoryConfidence: cls.score,
      isDuplicate: false, // dedupe already passed above
      aiValidationConfidence: aiVal?.confidence ?? null,
      hasConflict,
      textLength: fullText.length,
    });
    await prisma.sourceItem.update({ where: { id: item.id }, data: { qualityScore: quality.score } });

    // 6. Typed record (Job/AdmitCard/Result/AnswerKey/Notice).
    const typed = await createTypedRecord(item, cls.category, extracted, title);

    // 7. AI DRAFT (or deterministic template). Body is sanitised before storage.
    const generated = settings.autoDraft
      ? await generateArticle({
          category: cls.category,
          title: item.title ?? title ?? "Update",
          sourceText: fullText,
          verifiedData: extracted,
          officialSourceUrl: item.url,
        })
      : null;
    const cleanBody = sanitizeHtml(generated?.body) || null;

    const verification = hasConflict
      ? VerificationStatus.SOURCE_CONFLICT
      : aiVal?.supported
        ? VerificationStatus.AI_VERIFIED
        : generated?.aiGenerated
          ? VerificationStatus.AI_ASSISTED
          : VerificationStatus.AUTO_EXTRACTED;

    await prisma.sourceItem.update({
      where: { id: item.id },
      data: { stage: ProcessingStage.AI_PROCESSED, verification },
    });

    // 8. AUTO-PUBLISH DECISION (automation by default; review is the exception).
    const minScore = settings.minPublishScore ?? 80;
    const canAuto =
      settings.autoPublish &&
      quality.score >= minScore &&
      quality.requiredOk &&
      quality.breakdown.urlValidation > 0 &&
      !hasConflict;

    const reviewReason = canAuto
      ? null
      : !settings.autoPublish
        ? "Auto-publish disabled for this category"
        : quality.reasons.length
          ? quality.reasons.join("; ")
          : `Quality ${quality.score} below threshold ${minScore}`;

    const slug = await uniqueSlug(item.title ?? title ?? "update", async (s) => {
      return (await prisma.article.count({ where: { slug: s } })) > 0;
    });

    const article = await prisma.article.create({
      data: {
        slug,
        category: cls.category,
        title: item.title ?? title ?? "Exam Update",
        shortSummary: generated?.shortSummary ?? null,
        body: cleanBody,
        faq: generated?.faq ?? undefined,
        importantPoints: generated?.importantPoints ?? [],
        aiGenerated: generated?.aiGenerated ?? false,
        officialSource: item.source.name,
        officialSourceUrl: item.url,
        sourceItemId: item.id,
        verificationStatus: verification,
        qualityScore: quality.score,
        reviewReason,
        status: PublishStatus.PENDING_REVIEW,
        ...typed.articleLink,
      },
    });

    await prisma.articleSource.create({
      data: { articleId: article.id, sourceName: item.source.name, sourceUrl: item.url, isOfficial: true },
    });

    if (canAuto) {
      await publishArticle(article.id);
      await prisma.sourceItem.update({ where: { id: item.id }, data: { stage: ProcessingStage.PUBLISHED } });
      log.info("Auto-published", { slug, score: quality.score, category: cls.category });
      return ProcessingStage.PUBLISHED;
    }

    log.info("Routed to review", { slug, score: quality.score, reason: reviewReason });
    await prisma.sourceItem.update({ where: { id: item.id }, data: { stage: ProcessingStage.PENDING_REVIEW } });
    return ProcessingStage.PENDING_REVIEW;
  } catch (err) {
    log.error("Pipeline error", { item: item.url, err: err instanceof Error ? err.message : String(err) });
    await prisma.sourceItem.update({ where: { id: item.id }, data: { stage: ProcessingStage.FAILED } });
    return ProcessingStage.FAILED;
  }
}

// --- helpers ------------------------------------------------------------

async function gatherContent(
  item: SourceItem & { source: unknown }
): Promise<{ text: string; title: string; documentId: string | null }> {
  // Already have raw content (e.g. RSS body / PDF source).
  if (item.rawContent && item.rawContent.length > 200) {
    return { text: item.rawContent, title: item.title ?? "", documentId: item.documentId };
  }

  // PDF link.
  if (/\.pdf(\?|#|$)/i.test(item.url)) {
    const doc = await ingestPdf(item.url);
    return { text: doc?.text ?? "", title: item.title ?? "", documentId: doc?.documentId ?? null };
  }

  // HTML detail page.
  const page = await fetchPageText(item.url);
  let documentId: string | null = null;
  let text = page?.text ?? item.summary ?? "";
  // If the page links a primary PDF, ingest it for richer extraction.
  if (page?.documentUrls?.length) {
    const doc = await ingestPdf(page.documentUrls[0]);
    if (doc) {
      documentId = doc.documentId;
      text = `${text}\n\n${doc.text}`.trim();
    }
  }
  return { text, title: page?.title ?? item.title ?? "", documentId };
}

async function ingestPdf(url: string): Promise<{ text: string; documentId: string } | null> {
  const extract = await downloadAndExtractPdf(url);
  if (!extract) return null;

  const existing = await prisma.document.findUnique({ where: { sha256: extract.sha256 } });
  if (existing) return { text: existing.extractedText ?? extract.text, documentId: existing.id };

  let storageKey: string | null = null;
  try {
    // best-effort store handled elsewhere; we persist metadata + text here.
    storageKey = `documents/${extract.sha256}.pdf`;
  } catch {
    storageKey = null;
  }

  const doc = await prisma.document.create({
    data: {
      sourceUrl: url,
      storageKey,
      mimeType: "application/pdf",
      sha256: extract.sha256,
      fileSize: extract.fileSize,
      pageCount: extract.pageCount,
      extractedText: extract.text.slice(0, 200000),
      metadata: extract.metadata as object,
    },
  });
  return { text: extract.text, documentId: doc.id };
}

async function createTypedRecord(
  item: SourceItem,
  category: ContentCategory,
  data: Record<string, unknown>,
  fallbackTitle: string
): Promise<{ articleLink: Record<string, string> }> {
  const title = item.title ?? fallbackTitle ?? "Update";
  const mkSlug = async (model: "job" | "admitCard" | "result" | "answerKey" | "notice") =>
    uniqueSlug(title, async (s) => {
      // @ts-expect-error dynamic model access
      return (await prisma[model].count({ where: { slug: s } })) > 0;
    });

  const provenance = {
    sourceItemId: item.id,
    sourceId: item.sourceId,
    sourceUrl: item.url,
    verificationStatus: VerificationStatus.AUTO_EXTRACTED,
  };

  switch (category) {
    case ContentCategory.JOB: {
      const j = await prisma.job.create({
        data: {
          slug: await mkSlug("job"),
          title,
          postName: (data.postName as string) ?? null,
          vacancyCount: (data.vacancyCount as number) ?? null,
          qualification: (data.qualification as string) ?? null,
          ageLimit: (data.ageLimit as string) ?? null,
          applicationStart: toDate(data.applicationStart),
          applicationEnd: toDate(data.applicationEnd),
          applicationFee: (data.applicationFee as string) ?? null,
          examDate: toDate(data.examDate),
          importantDates: (data.importantDates as object) ?? undefined,
          officialNotificationUrl: (data.officialNotificationUrl as string) ?? null,
          applyOnlineUrl: (data.applyOnlineUrl as string) ?? null,
          ...provenance,
        },
      });
      return { articleLink: { jobId: j.id } };
    }
    case ContentCategory.ADMIT_CARD: {
      const a = await prisma.admitCard.create({
        data: {
          slug: await mkSlug("admitCard"),
          title,
          examName: (data.examName as string) ?? null,
          releaseDate: toDate(data.releaseDate),
          examDate: toDate(data.examDate),
          examShift: (data.examShift as string) ?? null,
          downloadUrl: (data.downloadUrl as string) ?? null,
          ...provenance,
        },
      });
      return { articleLink: { admitCardId: a.id } };
    }
    case ContentCategory.RESULT: {
      const r = await prisma.result.create({
        data: {
          slug: await mkSlug("result"),
          title,
          examName: (data.examName as string) ?? null,
          releaseDate: toDate(data.releaseDate),
          resultType: (data.resultType as string) ?? null,
          resultUrl: (data.resultUrl as string) ?? null,
          ...provenance,
        },
      });
      return { articleLink: { resultId: r.id } };
    }
    case ContentCategory.ANSWER_KEY: {
      const k = await prisma.answerKey.create({
        data: {
          slug: await mkSlug("answerKey"),
          title,
          examName: (data.examName as string) ?? null,
          examDate: toDate(data.examDate),
          keyType: (data.keyType as string) ?? null,
          isFinal: Boolean(data.isFinal),
          objectionStart: toDate(data.objectionStart),
          objectionEnd: toDate(data.objectionEnd),
          answerKeyUrl: (data.answerKeyUrl as string) ?? null,
          ...provenance,
        },
      });
      return { articleLink: { answerKeyId: k.id } };
    }
    default: {
      const n = await prisma.notice.create({
        data: {
          slug: await mkSlug("notice"),
          title,
          body: item.summary ?? null,
          ...provenance,
        },
      });
      return { articleLink: { noticeId: n.id } };
    }
  }
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}
