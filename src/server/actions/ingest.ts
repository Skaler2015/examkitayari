"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/rbac";
import { SourceType, ContentCategory } from "@prisma/client";
import { fetchSitemapEntries } from "@/server/crawler/sitemap";
import { extractPdfBuffer } from "@/server/crawler/pdf";
import { ocrImage, isOcrEnabled } from "@/server/ocr";
import { processSourceItem } from "@/server/pipeline/process";
import { enqueue } from "@/server/queue";
import { normalizeUrl } from "@/lib/utils";
import { writeAudit } from "./audit";

async function getOrCreateSource(name: string, monitorUrl: string, type: SourceType) {
  const existing = await prisma.source.findFirst({ where: { monitorUrl } });
  if (existing) return existing;
  return prisma.source.create({
    data: { name, monitorUrl, type, isActive: false, frequencyMinutes: 1440 },
  });
}

// --- 1. Discover from a sitemap within a date range ---------------------

export type DiscoverState = { error?: string; ok?: boolean; message?: string };

const discoverSchema = z.object({
  sitemapUrl: z.string().url(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function discoverFromSitemap(_prev: DiscoverState, formData: FormData): Promise<DiscoverState> {
  await requirePermission("sources:write");
  const parsed = discoverSchema.safeParse({
    sitemapUrl: formData.get("sitemapUrl"),
    from: formData.get("from") || undefined,
    to: formData.get("to") || undefined,
  });
  if (!parsed.success) return { error: "Enter a valid sitemap URL." };

  const from = parsed.data.from ? new Date(parsed.data.from) : null;
  const to = parsed.data.to ? new Date(`${parsed.data.to}T23:59:59`) : null;

  let entries;
  try {
    entries = await fetchSitemapEntries(parsed.data.sitemapUrl);
  } catch {
    return { error: "Could not fetch or parse the sitemap." };
  }
  if (entries.length === 0) return { error: "No URLs found in that sitemap." };

  // Filter by lastmod within [from, to]. Entries without lastmod are only kept
  // when no date filter is set.
  const inRange = entries.filter((e) => {
    if (!from && !to) return true;
    if (!e.lastmod) return false;
    if (from && e.lastmod < from) return false;
    if (to && e.lastmod > to) return false;
    return true;
  });
  if (inRange.length === 0) return { error: "No pages found in that date range." };

  const host = (() => {
    try {
      return new URL(parsed.data.sitemapUrl).hostname;
    } catch {
      return "sitemap";
    }
  })();
  const source = await getOrCreateSource(`Sitemap: ${host}`, parsed.data.sitemapUrl, SourceType.SITEMAP);

  let created = 0;
  for (const e of inRange.slice(0, 300)) {
    const url = normalizeUrl(e.loc) ?? e.loc;
    const item = await prisma.sourceItem.upsert({
      where: { sourceId_url: { sourceId: source.id, url } },
      create: { sourceId: source.id, url, publishedAt: e.lastmod ?? null, itemUpdatedAt: e.lastmod ?? null },
      update: {},
    });
    // Only enqueue freshly-created items (avoid reprocessing existing).
    if (item.stage === "DISCOVERED" && item.createdAt.getTime() > Date.now() - 5000) {
      await enqueue("PROCESS_ITEM", { itemId: item.id }, { dedupeKey: `process:${item.id}` });
      created++;
    }
  }

  await writeAudit("ingest.sitemap_discover", "Source", source.id, { found: inRange.length, queued: created });
  revalidatePath("/admin/review");
  return {
    ok: true,
    message: `${inRange.length} page(s) in range; ${created} new item(s) queued for processing. Drafts will appear in Pending Review shortly.`,
  };
}

// --- 2. Add a new post manually (URL / PDF / image / text) --------------

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export type ManualState = { error?: string };

export async function createManualPost(_prev: ManualState, formData: FormData): Promise<ManualState> {
  await requirePermission("articles:write");

  const type = String(formData.get("type") || "url");
  const title = (formData.get("title") as string)?.trim() || "";
  const officialUrl = (formData.get("officialUrl") as string)?.trim() || "";
  const categoryRaw = (formData.get("category") as string) || "";
  const forcedCategory = (Object.values(ContentCategory) as string[]).includes(categoryRaw)
    ? (categoryRaw as ContentCategory)
    : null;

  const source = await getOrCreateSource("Manual Entry", "https://examskitayari.com/manual", SourceType.HTML_PAGE);

  let itemUrl = officialUrl ? normalizeUrl(officialUrl) ?? officialUrl : "";
  let rawContent = "";

  try {
    if (type === "url") {
      const u = (formData.get("url") as string)?.trim();
      if (!u || !/^https?:\/\//.test(u)) return { error: "Enter a valid http(s) URL." };
      itemUrl = normalizeUrl(u) ?? u;
      // rawContent left empty → the pipeline fetches & extracts the page/PDF.
    } else if (type === "pdf" || type === "image") {
      const file = formData.get("file") as File | null;
      if (!file || !file.size) return { error: "Choose a file to upload." };
      if (file.size > MAX_FILE_BYTES) return { error: "File too large (max 15 MB)." };
      const buf = Buffer.from(await file.arrayBuffer());
      if (type === "pdf") {
        if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf"))
          return { error: "Please upload a PDF file." };
        const extract = await extractPdfBuffer(buf);
        rawContent = extract.text;
        if (!rawContent || rawContent.replace(/\s+/g, "").length < 40)
          return { error: "Couldn't read text from this PDF. If it's scanned, enable OCR (Admin → AI Provider)." };
      } else {
        if (!isOcrEnabled()) return { error: "Importing from an image needs OCR. Enable it in Admin → AI Provider." };
        const text = await ocrImage(buf, file.type || "image/jpeg");
        if (!text || text.replace(/\s+/g, "").length < 20)
          return { error: "OCR couldn't read enough text from this image." };
        rawContent = text;
      }
    } else if (type === "text") {
      const body = (formData.get("body") as string)?.trim();
      if (!title && !body) return { error: "Enter a title and/or content." };
      rawContent = `${title}\n\n${body ?? ""}`.trim();
    } else {
      return { error: "Unknown input type." };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to read input." };
  }

  if (!itemUrl) itemUrl = `https://examskitayari.com/manual/${Date.now()}-${Math.round(performance.now())}`;

  const item = await prisma.sourceItem.create({
    data: {
      sourceId: source.id,
      url: itemUrl,
      title: title || null,
      rawContent: rawContent || null,
      category: forcedCategory,
    },
  });

  const stage = await processSourceItem(item.id);
  const article = await prisma.article.findFirst({ where: { sourceItemId: item.id } });

  // Keep provenance honest for manual entries without an official link.
  if (article && !officialUrl && (type === "pdf" || type === "image" || type === "text")) {
    await prisma.article.update({
      where: { id: article.id },
      data: { officialSource: "Manual (admin)", officialSourceUrl: null },
    });
  }

  await writeAudit("ingest.manual_post", "Article", article?.id, { type, stage });

  if (!article) {
    return { error: `Processed but no draft was created (stage: ${stage}). It may be a duplicate.` };
  }
  redirect(`/admin/articles/${article.id}`);
}
