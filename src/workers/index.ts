/**
 * Worker process: continuously claims and runs queued AutomationJobs.
 * Run multiple instances for horizontal scale. Run with: `npm run worker`.
 */
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { claimNextJob, completeJob } from "@/server/queue";
import { runJob } from "@/server/queue/runner";

const log = logger.child("worker");
const CONCURRENCY = env.crawler.maxConcurrency;
const IDLE_MS = 2000;

let running = 0;
let stopping = false;

async function loop() {
  while (!stopping) {
    if (running >= CONCURRENCY) {
      await sleep(100);
      continue;
    }
    const job = await claimNextJob().catch((e) => {
      log.error("claim error", { err: String(e) });
      return null;
    });
    if (!job) {
      await sleep(IDLE_MS);
      continue;
    }
    running++;
    void (async () => {
      try {
        await runJob(job);
        await completeJob(job.id, true);
      } catch (err) {
        await completeJob(job.id, false, err instanceof Error ? err.message : String(err));
      } finally {
        running--;
      }
    })();
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

process.on("SIGINT", () => {
  log.info("Worker stopping...");
  stopping = true;
  setTimeout(() => process.exit(0), 3000);
});
process.on("SIGTERM", () => {
  stopping = true;
  setTimeout(() => process.exit(0), 3000);
});

log.info("Worker started", { concurrency: CONCURRENCY });
loop().catch((e) => {
  log.error("Worker crashed", { err: String(e) });
  process.exit(1);
});
