import type { SourceItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeUrl, titleSimilarity } from "@/lib/utils";

export type DuplicateMatch = {
  isDuplicate: boolean;
  existingItemId?: string;
  reason?: string;
  similarity?: number;
};

/**
 * Detect whether a discovered item duplicates an already-processed item.
 * Checks (in order): exact source/canonical URL, content hash, and fuzzy
 * title similarity within the same category & organization window.
 */
export async function findDuplicate(item: SourceItem): Promise<DuplicateMatch> {
  const canonical = item.canonicalUrl || normalizeUrl(item.url) || item.url;

  // 1. Exact canonical/source URL match on a different item that produced content.
  const urlMatch = await prisma.sourceItem.findFirst({
    where: {
      id: { not: item.id },
      OR: [{ url: canonical }, { canonicalUrl: canonical }],
      stage: { in: ["PUBLISHED", "PENDING_REVIEW", "AI_PROCESSED", "EXTRACTED"] },
    },
    select: { id: true },
  });
  if (urlMatch) return { isDuplicate: true, existingItemId: urlMatch.id, reason: "URL match" };

  // 2. Content hash match.
  if (item.contentHash) {
    const hashMatch = await prisma.sourceItem.findFirst({
      where: {
        id: { not: item.id },
        contentHash: item.contentHash,
        stage: { in: ["PUBLISHED", "PENDING_REVIEW", "AI_PROCESSED", "EXTRACTED"] },
      },
      select: { id: true },
    });
    if (hashMatch) return { isDuplicate: true, existingItemId: hashMatch.id, reason: "Content hash match" };
  }

  // 3. Fuzzy title match within same category (recent window).
  if (item.title && item.category) {
    const candidates = await prisma.sourceItem.findMany({
      where: {
        id: { not: item.id },
        category: item.category,
        title: { not: null },
        stage: { in: ["PUBLISHED", "PENDING_REVIEW", "AI_PROCESSED", "EXTRACTED"] },
        createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120) },
      },
      select: { id: true, title: true },
      take: 200,
    });
    for (const c of candidates) {
      const sim = titleSimilarity(item.title, c.title ?? "");
      if (sim >= 0.9) {
        return { isDuplicate: true, existingItemId: c.id, reason: "Title similarity", similarity: sim };
      }
    }
  }

  // 4. Document (PDF) hash match — if item is linked to a document.
  if (item.documentId) {
    const docMatch = await prisma.sourceItem.findFirst({
      where: {
        id: { not: item.id },
        documentId: item.documentId,
        stage: { in: ["PUBLISHED", "PENDING_REVIEW", "AI_PROCESSED"] },
      },
      select: { id: true },
    });
    if (docMatch) return { isDuplicate: true, existingItemId: docMatch.id, reason: "PDF hash match" };
  }

  return { isDuplicate: false };
}
