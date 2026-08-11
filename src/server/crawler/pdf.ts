import type { Source } from "@prisma/client";
import { politeFetch } from "./http";
import type { CrawlOutcome, DiscoveredItem, SourceAdapter } from "./types";
import { sha256 } from "@/lib/hash";
import { logger } from "@/lib/logger";
import { isOcrEnabled, needsOcr, ocrPdf } from "@/server/ocr";

const log = logger.child("pdf");

export type PdfExtract = {
  sha256: string;
  fileSize: number;
  pageCount: number;
  text: string;
  metadata: Record<string, unknown>;
  ocrUsed?: boolean;
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
  return extractPdfBuffer(res.buffer);
}

/** Extract text (with OCR fallback) from a PDF buffer — used by crawl + manual upload. */
export async function extractPdfBuffer(buffer: Buffer): Promise<PdfExtract> {
  const hash = sha256(buffer);
  let text = "";
  let pageCount = 0;
  let metadata: Record<string, unknown> = {};

  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    text = (data.text ?? "").replace(/\s+\n/g, "\n").trim();
    pageCount = data.numpages ?? 0;
    metadata = (data.info as Record<string, unknown>) ?? {};
  } catch (err) {
    log.error("PDF parse error", { err: String(err) });
    // Fall through with empty text — OCR (if enabled) may still recover it.
  }

  // OCR FALLBACK: scanned/image PDFs yield little or no embedded text.
  let ocrUsed = false;
  if (isOcrEnabled() && needsOcr(text, pageCount)) {
    log.info("PDF text insufficient — running OCR", { chars: text.length, pageCount });
    const ocrText = await ocrPdf(buffer);
    if (ocrText && ocrText.replace(/\s+/g, "").length > text.replace(/\s+/g, "").length) {
      text = ocrText;
      ocrUsed = true;
      metadata.ocr = true;
    }
  }

  return { sha256: hash, fileSize: buffer.length, pageCount, text, metadata, ocrUsed };
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
