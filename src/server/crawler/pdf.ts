import type { Source } from "@prisma/client";
import { politeFetch } from "./http";
import type { CrawlOutcome, DiscoveredItem, SourceAdapter } from "./types";
import { sha256 } from "@/lib/hash";
import { logger } from "@/lib/logger";

const log = logger.child("pdf");

export type PdfExtract = {
  sha256: string;
  fileSize: number;
  pageCount: number;
  text: string;
  metadata: Record<string, unknown>;
};

/**
 * Download and extract a PDF. `pdf-parse` is imported lazily because it reads
 * from disk at module load in some versions; lazy import keeps the app bundle
 * clean and avoids side effects during build.
 */
export async function downloadAndExtractPdf(url: string): Promise<PdfExtract | null> {
  const res = await politeFetch(url, { binary: true });
  if (!res.ok || !res.buffer) {
    log.warn("PDF download failed", { url, status: res.status });
    return null;
  }
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(res.buffer);
    return {
      sha256: sha256(res.buffer),
      fileSize: res.buffer.length,
      pageCount: data.numpages ?? 0,
      text: (data.text ?? "").replace(/\s+\n/g, "\n").trim(),
      metadata: (data.info as Record<string, unknown>) ?? {},
    };
  } catch (err) {
    log.error("PDF parse error", { url, err: String(err) });
    // Even if text extraction fails, we still have the hash + size for change detection.
    return {
      sha256: sha256(res.buffer),
      fileSize: res.buffer.length,
      pageCount: 0,
      text: "",
      metadata: {},
    };
  }
}

/** A source whose monitorUrl points directly at a PDF. */
export const pdfAdapter: SourceAdapter = {
  async crawl(source: Source): Promise<CrawlOutcome> {
    const extract = await downloadAndExtractPdf(source.monitorUrl);
    if (!extract) {
      return { ok: false, items: [], error: "PDF download/parse failed" };
    }
    const item: DiscoveredItem = {
      url: source.monitorUrl,
      externalId: extract.sha256,
      title: (extract.metadata.Title as string) || source.name,
      rawContent: extract.text,
      documentUrls: [source.monitorUrl],
      contentHash: extract.sha256, // hash drives change detection for PDFs
    };
    return { ok: true, items: [item] };
  },
};
