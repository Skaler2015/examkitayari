import * as cheerio from "cheerio";
import type { Source } from "@prisma/client";
import { politeFetch } from "./http";
import type { CrawlOutcome, DiscoveredItem, SourceAdapter } from "./types";
import { normalizeUrl } from "@/lib/utils";
import { fingerprint } from "@/lib/hash";
import { isLikelyPdf, matchesRules } from "./filters";

type ParseConfig = {
  itemSelector?: string;
  linkSelector?: string;
  titleSelector?: string;
  dateSelector?: string;
};

/** Parse a listing page: extract links, titles, dates and linked PDFs. */
export const htmlAdapter: SourceAdapter = {
  async crawl(source: Source): Promise<CrawlOutcome> {
    const target = source.listingUrl || source.monitorUrl;
    const res = await politeFetch(target, {});
    if (!res.ok || !res.body) {
      return { ok: false, httpStatus: res.status, responseMs: res.responseMs, items: [], error: res.error };
    }

    try {
      const $ = cheerio.load(res.body);
      const cfg = (source.parseConfig as ParseConfig | null) ?? {};
      const items: DiscoveredItem[] = [];
      const seen = new Set<string>();

      const scope = cfg.itemSelector ? $(cfg.itemSelector) : $("a[href]");

      const pushLink = (href: string | undefined, text: string, ctxHtml: string) => {
        if (!href) return;
        const link = normalizeUrl(href, res.finalUrl);
        if (!link || seen.has(link)) return;
        // Skip anchors, mailto, javascript, and same-page fragments.
        if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
        if (!matchesRules(link, text, source)) return;
        seen.add(link);

        const documentUrls: string[] = [];
        if (isLikelyPdf(link)) documentUrls.push(link);

        items.push({
          url: link,
          externalId: link,
          title: text.replace(/\s+/g, " ").trim() || null,
          documentUrls,
          contentHash: fingerprint(`${link}|${text.trim()}`),
        });
      };

      if (cfg.itemSelector) {
        scope.each((_i, el) => {
          const $el = $(el);
          const href =
            (cfg.linkSelector ? $el.find(cfg.linkSelector).attr("href") : $el.find("a").attr("href")) ||
            $el.attr("href");
          const title = cfg.titleSelector
            ? $el.find(cfg.titleSelector).text()
            : $el.find("a").first().text() || $el.text();
          pushLink(href, title, $.html($el));
        });
      } else {
        $("a[href]").each((_i, el) => {
          const $el = $(el);
          pushLink($el.attr("href"), $el.text(), $.html($el));
        });
      }

      // Also collect standalone PDF links found anywhere on the page.
      $("a[href]").each((_i, el) => {
        const href = $(el).attr("href");
        if (href && isLikelyPdf(href)) {
          const link = normalizeUrl(href, res.finalUrl);
          if (link && !seen.has(link) && matchesRules(link, $(el).text(), source)) {
            seen.add(link);
            items.push({
              url: link,
              externalId: link,
              title: $(el).text().replace(/\s+/g, " ").trim() || "Document",
              documentUrls: [link],
              contentHash: fingerprint(link),
            });
          }
        }
      });

      return {
        ok: true,
        httpStatus: res.status,
        responseMs: res.responseMs,
        items: items.slice(0, 300),
        etag: res.headers["etag"] ?? null,
        lastModified: res.headers["last-modified"] ?? null,
      };
    } catch (err) {
      return {
        ok: false,
        httpStatus: res.status,
        responseMs: res.responseMs,
        items: [],
        error: err instanceof Error ? err.message : "HTML parse error",
      };
    }
  },
};

/** Fetch a single article/detail page and return its main text content. */
export async function fetchPageText(url: string): Promise<{ text: string; title: string; documentUrls: string[] } | null> {
  const res = await politeFetch(url, {});
  if (!res.ok || !res.body) return null;
  const $ = cheerio.load(res.body);
  $("script, style, nav, footer, header, noscript, iframe").remove();
  const title = $("h1").first().text().trim() || $("title").text().trim();
  const main = $("main").text() || $("article").text() || $("body").text();
  const documentUrls: string[] = [];
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (href && isLikelyPdf(href)) {
      const abs = normalizeUrl(href, res.finalUrl);
      if (abs) documentUrls.push(abs);
    }
  });
  return {
    title,
    text: main.replace(/\s+/g, " ").trim().slice(0, 20000),
    documentUrls: [...new Set(documentUrls)],
  };
}
