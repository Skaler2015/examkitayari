import type { Source } from "@prisma/client";
import { SourceType, CrawlStatus, ChangeType, SourceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rssAdapter } from "./rss";
import { sitemapAdapter } from "./sitemap";
import { htmlAdapter } from "./html";
import { pdfAdapter } from "./pdf";
import { jsonAdapter } from "./json";
import type { CrawlOutcome, SourceAdapter } from "./types";

const log = logger.child("crawler");

function pickAdapter(type: SourceType): SourceAdapter {
  switch (type) {
    case SourceType.RSS:
      return rssAdapter;
    case SourceType.SITEMAP:
      return sitemapAdapter;
    case SourceType.PDF:
      return pdfAdapter;
    case SourceType.JSON_API:
    case SourceType.XML:
      return jsonAdapter;
    case SourceType.HTML_PAGE:
    case SourceType.OFFICIAL_RESULT_PAGE:
    case SourceType.OFFICIAL_RECRUITMENT_PAGE:
    default:
      return htmlAdapter;
  }
}

const WARNING_THRESHOLD = 3;
const ERROR_THRESHOLD = 6;

/**
 * Crawl a single source: run the adapter, persist a SourceCrawl, upsert
 * SourceItems, record SourceChanges (NEW / UPDATED), and update health.
 * Returns the ids of items that are NEW or UPDATED for downstream processing.
 */
export async function crawlSource(source: Source): Promise<{ crawlId: string; changedItemIds: string[] }> {
  const adapter = pickAdapter(source.type);
  const crawl = await prisma.sourceCrawl.create({
    data: { sourceId: source.id, status: CrawlStatus.FAILED },
  });

  let outcome: CrawlOutcome;
  try {
    outcome = await adapter.crawl(source);
  } catch (err) {
    outcome = { ok: false, items: [], error: err instanceof Error ? err.message : String(err) };
  }

  const changedItemIds: string[] = [];
  let itemsNew = 0;
  let itemsUpdated = 0;

  if (outcome.ok) {
    for (const disc of outcome.items) {
      const existing = await prisma.sourceItem.findUnique({
        where: { sourceId_url: { sourceId: source.id, url: disc.url } },
      });

      if (!existing) {
        const created = await prisma.sourceItem.create({
          data: {
            sourceId: source.id,
            externalId: disc.externalId ?? null,
            url: disc.url,
            title: disc.title ?? null,
            summary: disc.summary ?? null,
            publishedAt: disc.publishedAt ?? null,
            itemUpdatedAt: disc.updatedAt ?? null,
            contentHash: disc.contentHash ?? null,
            rawContent: disc.rawContent ?? null,
          },
        });
        await prisma.sourceChange.create({
          data: {
            sourceId: source.id,
            crawlId: crawl.id,
            itemId: created.id,
            type: ChangeType.NEW,
            url: disc.url,
          },
        });
        itemsNew++;
        changedItemIds.push(created.id);
      } else if (existing.contentHash && disc.contentHash && existing.contentHash !== disc.contentHash) {
        // Content changed → UPDATED.
        await prisma.sourceItem.update({
          where: { id: existing.id },
          data: {
            title: disc.title ?? existing.title,
            summary: disc.summary ?? existing.summary,
            contentHash: disc.contentHash,
            itemUpdatedAt: disc.updatedAt ?? new Date(),
            // Reset processing so the change is re-evaluated.
            stage: "DISCOVERED",
          },
        });
        await prisma.sourceChange.create({
          data: {
            sourceId: source.id,
            crawlId: crawl.id,
            itemId: existing.id,
            type: ChangeType.UPDATED,
            url: disc.url,
            field: "contentHash",
            oldValue: existing.contentHash,
            newValue: disc.contentHash,
          },
        });
        itemsUpdated++;
        changedItemIds.push(existing.id);
      }
      // else UNCHANGED — no action.
    }
  }

  // Persist crawl result.
  const status: CrawlStatus = outcome.ok ? CrawlStatus.SUCCESS : CrawlStatus.FAILED;
  await prisma.sourceCrawl.update({
    where: { id: crawl.id },
    data: {
      status,
      httpStatus: outcome.httpStatus ?? null,
      responseMs: outcome.responseMs ?? null,
      itemsFound: outcome.items.length,
      itemsNew,
      itemsUpdated,
      error: outcome.error ?? null,
      finishedAt: new Date(),
    },
  });

  // Update source health.
  const now = new Date();
  const nextCrawlAt = new Date(now.getTime() + source.frequencyMinutes * 60 * 1000);
  if (outcome.ok) {
    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: now,
        lastSuccessAt: now,
        nextCrawlAt,
        lastHttpStatus: outcome.httpStatus ?? null,
        lastResponseMs: outcome.responseMs ?? null,
        lastItemsFound: outcome.items.length,
        consecutiveFailures: 0,
        lastError: null,
        status: source.status === SourceStatus.DISABLED ? SourceStatus.DISABLED : SourceStatus.ACTIVE,
      },
    });
  } else {
    const failures = source.consecutiveFailures + 1;
    let newStatus: SourceStatus = source.status;
    if (source.status !== SourceStatus.DISABLED && source.status !== SourceStatus.BLOCKED) {
      if (outcome.httpStatus === 999) newStatus = SourceStatus.BLOCKED;
      else if (failures >= ERROR_THRESHOLD) newStatus = SourceStatus.ERROR;
      else if (failures >= WARNING_THRESHOLD) newStatus = SourceStatus.WARNING;
    }
    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: now,
        nextCrawlAt,
        lastHttpStatus: outcome.httpStatus ?? null,
        lastResponseMs: outcome.responseMs ?? null,
        consecutiveFailures: failures,
        lastError: outcome.error ?? "Unknown error",
        status: newStatus,
      },
    });
    log.warn("Source crawl failed", { source: source.name, error: outcome.error, failures });
  }

  return { crawlId: crawl.id, changedItemIds };
}
