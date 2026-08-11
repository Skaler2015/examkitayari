import type { Source } from "@prisma/client";
import { politeFetch } from "./http";
import type { CrawlOutcome, DiscoveredItem, SourceAdapter } from "./types";
import { normalizeUrl } from "@/lib/utils";
import { fingerprint } from "@/lib/hash";
import { matchesRules } from "./filters";

type JsonParseConfig = {
  itemsPath?: string; // dot path to the array, e.g. "data.items"
  urlField?: string;
  titleField?: string;
  idField?: string;
  dateField?: string;
  summaryField?: string;
};

function getPath(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * JSON API adapter. Credentials, if any, are referenced via env — never
 * hardcoded. `parseConfig` describes how to map the response to items.
 */
export const jsonAdapter: SourceAdapter = {
  async crawl(source: Source): Promise<CrawlOutcome> {
    const res = await politeFetch(source.monitorUrl, {});
    if (!res.ok || !res.body) {
      return { ok: false, httpStatus: res.status, responseMs: res.responseMs, items: [], error: res.error };
    }
    try {
      const json = JSON.parse(res.body);
      const cfg = (source.parseConfig as JsonParseConfig | null) ?? {};
      const rawItems = getPath(json, cfg.itemsPath);
      const arr = Array.isArray(rawItems) ? rawItems : Array.isArray(json) ? json : [];
      const items: DiscoveredItem[] = [];

      for (const raw of arr) {
        const rec = raw as Record<string, unknown>;
        const rawUrl = cfg.urlField ? String(rec[cfg.urlField] ?? "") : String(rec.url ?? rec.link ?? "");
        const link = rawUrl ? normalizeUrl(rawUrl, source.monitorUrl) : null;
        if (!link) continue;
        const title = cfg.titleField ? String(rec[cfg.titleField] ?? "") : String(rec.title ?? "");
        if (!matchesRules(link, title, source)) continue;
        const dateStr = cfg.dateField ? (rec[cfg.dateField] as string) : (rec.date as string);
        const date = dateStr ? new Date(dateStr) : null;
        items.push({
          url: link,
          externalId: cfg.idField ? String(rec[cfg.idField] ?? link) : link,
          title: title || null,
          summary: cfg.summaryField ? String(rec[cfg.summaryField] ?? "") : null,
          publishedAt: date && !isNaN(date.getTime()) ? date : null,
          contentHash: fingerprint(JSON.stringify(rec)),
        });
      }

      return { ok: true, httpStatus: res.status, responseMs: res.responseMs, items };
    } catch (err) {
      return {
        ok: false,
        httpStatus: res.status,
        responseMs: res.responseMs,
        items: [],
        error: err instanceof Error ? err.message : "JSON parse error",
      };
    }
  },
};
