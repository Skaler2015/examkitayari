import type { Source } from "@prisma/client";

/** A raw item discovered from a source before pipeline processing. */
export type DiscoveredItem = {
  url: string;
  externalId?: string | null;
  title?: string | null;
  summary?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  /** Raw text/html content associated with the item, if fetched. */
  rawContent?: string | null;
  /** Detected linked document (PDF) URLs. */
  documentUrls?: string[];
  /** Content hash for change detection (computed by adapter or pipeline). */
  contentHash?: string | null;
};

export type CrawlOutcome = {
  ok: boolean;
  httpStatus?: number;
  responseMs?: number;
  items: DiscoveredItem[];
  error?: string;
  /** Conditional-request headers to persist for next crawl. */
  etag?: string | null;
  lastModified?: string | null;
};

export interface SourceAdapter {
  crawl(source: Source): Promise<CrawlOutcome>;
}
