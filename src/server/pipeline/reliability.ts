import { prisma } from "@/lib/prisma";
import { CrawlStatus } from "@prisma/client";

// Well-known official Indian government / recruitment domains get a trust boost.
const OFFICIAL_DOMAIN_PATTERNS = [/\.gov\.in$/i, /\.nic\.in$/i, /\.ac\.in$/i, /\.gov$/i];

function officialDomainSignal(url: string | null | undefined): number {
  if (!url) return 0;
  try {
    const host = new URL(url).hostname;
    return OFFICIAL_DOMAIN_PATTERNS.some((p) => p.test(host)) ? 20 : 0;
  } catch {
    return 0;
  }
}

/**
 * Compute a 0..100 reliability score for a source from its crawl history plus
 * an official-domain signal, and persist it. Deterministic; no AI.
 */
export async function computeSourceReliability(sourceId: string): Promise<number> {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) return 0;

  const crawls = await prisma.sourceCrawl.findMany({
    where: { sourceId },
    orderBy: { startedAt: "desc" },
    take: 50,
    select: { status: true, itemsFound: true },
  });

  const domainSignal = officialDomainSignal(source.websiteUrl || source.monitorUrl);

  if (crawls.length === 0) {
    // New source: baseline from domain signal + a neutral middle.
    const score = Math.min(100, 40 + domainSignal);
    await prisma.source.update({ where: { id: sourceId }, data: { reliabilityScore: score } });
    return score;
  }

  const success = crawls.filter((c) => c.status === CrawlStatus.SUCCESS).length;
  const successPct = success / crawls.length; // 0..1
  const producing = crawls.filter((c) => (c.itemsFound ?? 0) > 0).length / crawls.length;

  // 50% crawl success, 20% produces items, 20% official domain, 10% low-failure streak.
  const failurePenalty = Math.min(1, source.consecutiveFailures / 6); // 0..1
  const score = Math.round(
    Math.min(
      100,
      successPct * 50 + producing * 20 + domainSignal + (1 - failurePenalty) * 10
    )
  );

  await prisma.source.update({ where: { id: sourceId }, data: { reliabilityScore: score } });
  return score;
}
