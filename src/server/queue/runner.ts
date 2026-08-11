import type { AutomationJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { crawlSource } from "@/server/crawler";
import { processSourceItem } from "@/server/pipeline/process";
import { publishArticle } from "@/server/pipeline/publish";
import { enqueue, jobLog } from ".";
import { getEffectiveSettings } from "@/server/automation/settings";

const log = logger.child("runner");

/** Execute a single job by type. Throws on failure (queue handles retry). */
export async function runJob(job: AutomationJob): Promise<void> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;

  switch (job.type) {
    case "CRAWL_SOURCE": {
      const sourceId = payload.sourceId as string;
      const source = await prisma.source.findUnique({ where: { id: sourceId } });
      if (!source) throw new Error(`Source ${sourceId} not found`);
      const { changedItemIds } = await crawlSource(source);
      await jobLog(job.id, "info", `Crawled ${source.name}: ${changedItemIds.length} changed`);
      // Fan out processing jobs for each new/updated item.
      const settings = await getEffectiveSettings();
      if (settings.sourceMonitoring) {
        for (const itemId of changedItemIds) {
          await enqueue("PROCESS_ITEM", { itemId }, { dedupeKey: `process:${itemId}` });
        }
      }
      break;
    }
    case "PROCESS_ITEM": {
      const itemId = payload.itemId as string;
      const stage = await processSourceItem(itemId);
      await jobLog(job.id, "info", `Processed item ${itemId} → ${stage}`);
      break;
    }
    case "PUBLISH": {
      const articleId = payload.articleId as string;
      await publishArticle(articleId, payload.reviewerId as string | undefined);
      break;
    }
    case "SITEMAP": {
      // Sitemap is generated on-demand by the /sitemap.xml route; nothing to do
      // here beyond touching a cache key. Left as a hook.
      await jobLog(job.id, "info", "Sitemap refresh requested");
      break;
    }
    case "NOTIFY": {
      await jobLog(job.id, "info", "Notify job executed");
      break;
    }
    default:
      log.warn("Unknown job type", { type: job.type });
  }
}
