import Parser from "rss-parser";
import type { Source } from "@prisma/client";
import { politeFetch } from "./http";
import type { CrawlOutcome, DiscoveredItem, SourceAdapter } from "./types";
import { normalizeUrl } from "@/lib/utils";
import { fingerprint } from "@/lib/hash";
import { matchesRules } from "./filters";

const parser = new Parser({
  customFields: { item: [["updated", "updated"], ["dc:date", "dcDate"]] },
});

export const rssAdapter: SourceAdapter = {
  async crawl(source: Source): Promise<CrawlOutcome> {
    const target = source.rssUrl || source.monitorUrl;
    const res = await politeFetch(target, {});
    if (!res.ok || !res.body) {
      return { ok: false, httpStatus: res.status, responseMs: res.responseMs, items: [], error: res.error };
    }
    try {
      const feed = await parser.parseString(res.body);
      const items: DiscoveredItem[] = [];
      for (const it of feed.items ?? []) {
        const link = it.link ? normalizeUrl(it.link, target) : null;
        if (!link) continue;
        if (!matchesRules(link, it.title ?? "", source)) continue;
        const published = it.isoDate ? new Date(it.isoDate) : it.pubDate ? new Date(it.pubDate) : null;
        const updatedRaw = (it as unknown as Record<string, unknown>).updated as string | undefined;
        items.push({
          url: link,
          externalId: it.guid ?? link,
          title: it.title ?? null,
          summary: it.contentSnippet ?? it.content ?? null,
          publishedAt: published && !isNaN(published.getTime()) ? published : null,
          updatedAt: updatedRaw ? new Date(updatedRaw) : null,
          contentHash: fingerprint(`${it.title ?? ""}|${it.guid ?? ""}|${it.pubDate ?? ""}`),
        });
      }
      return {
        ok: true,
        httpStatus: res.status,
        responseMs: res.responseMs,
        items,
        etag: res.headers["etag"] ?? null,
        lastModified: res.headers["last-modified"] ?? null,
      };
    } catch (err) {
      return {
        ok: false,
        httpStatus: res.status,
        responseMs: res.responseMs,
        items: [],
        error: err instanceof Error ? err.message : "RSS parse error",
      };
    }
  },
};
