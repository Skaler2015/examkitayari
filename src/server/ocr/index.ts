import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const log = logger.child("ocr");

export function isOcrEnabled(): boolean {
  return env.ocr.provider !== "none" && Boolean(env.ocr.apiKey || env.ocr.endpoint);
}

export function ocrStatus() {
  return {
    enabled: isOcrEnabled(),
    provider: env.ocr.provider,
    language: env.ocr.language,
    configured: Boolean(env.ocr.apiKey || env.ocr.endpoint),
  };
}

/**
 * Decide whether pdf-parse text is good enough, or whether OCR is needed.
 * Scanned/image PDFs yield almost no extractable text.
 */
export function needsOcr(text: string, pageCount: number): boolean {
  const dense = (text || "").replace(/\s+/g, "").length;
  const threshold = Math.max(120, (pageCount || 1) * 30);
  return dense < threshold;
}

/**
 * OCR a PDF buffer. Returns extracted text, or null when OCR is disabled or the
 * provider fails — callers keep the (possibly empty) pdf-parse text as fallback.
 */
export async function ocrPdf(buffer: Buffer): Promise<string | null> {
  if (!isOcrEnabled()) return null;
  try {
    if (env.ocr.provider === "ocrspace") return await ocrSpace(buffer);
    if (env.ocr.provider === "custom") return await ocrCustom(buffer);
  } catch (err) {
    log.error("OCR failed", { err: String(err) });
    return null;
  }
  return null;
}

async function ocrSpace(buffer: Buffer): Promise<string | null> {
  const form = new FormData();
  form.append("apikey", env.ocr.apiKey);
  form.append("filetype", "PDF");
  form.append("OCREngine", "2");
  form.append("scale", "true");
  form.append("language", env.ocr.language || "eng");
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), "document.pdf");

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(env.ocr.timeoutMs),
  });
  if (!res.ok) {
    log.warn("OCR.space HTTP error", { status: res.status });
    return null;
  }
  const json = (await res.json()) as {
    ParsedResults?: { ParsedText?: string }[];
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
  };
  if (json.IsErroredOnProcessing) {
    log.warn("OCR.space processing error", { err: String(json.ErrorMessage) });
    return null;
  }
  const text = (json.ParsedResults ?? []).map((r) => r.ParsedText ?? "").join("\n").trim();
  return text || null;
}

async function ocrCustom(buffer: Buffer): Promise<string | null> {
  const form = new FormData();
  if (env.ocr.apiKey) form.append("apikey", env.ocr.apiKey);
  form.append("language", env.ocr.language || "eng");
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), "document.pdf");
  const res = await fetch(env.ocr.endpoint, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(env.ocr.timeoutMs),
  });
  if (!res.ok) return null;
  // Accept either plain text or { text } JSON.
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = (await res.json()) as { text?: string };
    return j.text?.trim() || null;
  }
  return (await res.text()).trim() || null;
}
