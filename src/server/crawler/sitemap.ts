import { XMLParser } from "fast-xml-parser";
import type { Source } from "@prisma/client";
import { politeFetch } from "./http";
import type { CrawlOutcome, DiscoveredItem, SourceAdapter } from "./types";
import { normalizeUrl } from "@/lib/utils";
import { fingerprint } from "@/lib/hash";
import { matchesRules } from "./filters";

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

type SitemapUrl = { loc: string; lastmod?: string };

function extractUrls(parsed: unknown): SitemapUrl[] {
  const out: SitemapUrl[] = [];
  const root = parsed as Record<string, any>;
  if (root?.urlset?.url) {
    const arr = Array.isArray(root.urlset.url) ? root.urlset.url : [root.urlset.url];
    for (const u of arr) if (u?.loc) out.push({ loc: String(u.loc), lastmod: u.lastmod });
  }
  return out;
}

function extractSitemapIndex(parsed: unknown): string[] {
  const out: string[] = [];
  const root = parsed as Record<string, any>;
  if (root?.sitemapindex?.sitemap) {
    const arr = Array.isArray(root.sitemapindex.sitemap)
      ? root.sitemapindex.sitemap
      : [root.sitemapindex.sitemap];
    for (const s of arr) if (s?.loc) out.push(String(s.loc));
  }
  return out;
}

export const sitemapAdapter: SourceAdapter = {
  async crawl(source: Source): Promise<CrawlOutcome> {
    const target = source.sitemapUrl || source.monitorUrl;
    const res = await politeFetch(target, {});
    if (!res.ok || !res.body) {
      return { ok: false, httpStatus: res.status, responseMs: res.responseMs, items: [], error: res.error };
    }
    try {
      const parsed = xml.parse(res.body);
      const items: DiscoveredItem[] = [];

      // Handle sitemap index (fetch child sitemaps, but cap to avoid overload).
      const childSitemaps = extractSitemapIndex(parsed).slice(0, 5);
      const urlSets: SitemapUrl[] = extractUrls(parsed);

      for (const child of childSitemaps) {
        const childRes = await politeFetch(child, {});
        if (childRes.ok && childRes.body) {
          urlSets.push(...extractUrls(xml.parse(childRes.body)));
        }
      }

      for (const u of urlSets) {
        const link = normalizeUrl(u.loc, target);
        if (!link) continue;
        if (!matchesRules(link, "", source)) continue;
        const lastmod = u.lastmod ? new Date(u.lastmod) : null;
        items.push({
          url: link,
          externalId: link,
          title: null,
          publishedAt: lastmod && !isNaN(lastmod.getTime()) ? lastmod : null,
          updatedAt: lastmod && !isNaN(lastmod.getTime()) ? lastmod : null,
          contentHash: fingerprint(`${link}|${u.lastmod ?? ""}`),
        });
      }

      return {
        ok: true,
        httpStatus: res.status,
        responseMs: res.responseMs,
        items: items.slice(0, 500),
        etag: res.headers["etag"] ?? null,
        lastModified: res.headers["last-modified"] ?? null,
      };
    } catch (err) {
      return {
        ok: false,
        httpStatus: res.status,
        responseMs: res.responseMs,
        items: [],
        error: err instanceof Error ? err.message : "Sitemap parse error",
      };
    }
  },
};
