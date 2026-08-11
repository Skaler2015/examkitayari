/**
 * Scheduler process: periodically finds sources whose nextCrawlAt is due and
 * enqueues CRAWL_SOURCE jobs. Respects the global AUTOMATION_ENABLED switch and
 * the ADMIN automation settings. Run with: `npm run scheduler`.
 */
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { enqueue } from "@/server/queue";
import { isAutomationEnabled } from "@/server/automation/settings";
import { SourceStatus } from "@prisma/client";

const log = logger.child("scheduler");

async function tick() {
  if (!env.automation.enabled) {
    log.debug("Automation disabled via env — skipping tick");
    return;
  }
  const dbEnabled = await isAutomationEnabled();
  if (!dbEnabled) {
    log.debug("Source monitoring disabled via admin settings — skipping tick");
    return;
  }

  const now = new Date();
  const due = await prisma.source.findMany({
    where: {
      isActive: true,
      status: { notIn: [SourceStatus.DISABLED, SourceStatus.BLOCKED] },
      OR: [{ nextCrawlAt: null }, { nextCrawlAt: { lte: now } }],
    },
    orderBy: [{ priority: "asc" }, { nextCrawlAt: "asc" }],
    take: 50,
  });

  for (const source of due) {
    await enqueue("CRAWL_SOURCE", { sourceId: source.id }, { dedupeKey: `crawl:${source.id}` });
    // Optimistically push nextCrawlAt so we don't re-enqueue before it runs.
    await prisma.source.update({
      where: { id: source.id },
      data: { nextCrawlAt: new Date(now.getTime() + source.frequencyMinutes * 60 * 1000) },
    });
  }
  if (due.length) log.info(`Enqueued ${due.length} source crawl(s)`);
}

async function main() {
  log.info("Scheduler started", { tickSeconds: env.automation.schedulerTickSeconds });
  // Run immediately, then on an interval.
  await tick().catch((e) => log.error("tick error", { err: String(e) }));
  setInterval(() => {
    tick().catch((e) => log.error("tick error", { err: String(e) }));
  }, env.automation.schedulerTickSeconds * 1000);
}

main().catch((e) => {
  log.error("Scheduler crashed", { err: String(e) });
  process.exit(1);
});
