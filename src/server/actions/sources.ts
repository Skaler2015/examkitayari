"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth/rbac";
import { SourceType, Priority, ContentCategory } from "@prisma/client";
import { enqueue } from "@/server/queue";
import { writeAudit } from "@/server/actions/audit";

const sourceSchema = z.object({
  name: z.string().min(2),
  organizationId: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  monitorUrl: z.string().url(),
  type: z.nativeEnum(SourceType),
  rssUrl: z.string().url().optional().or(z.literal("")),
  sitemapUrl: z.string().url().optional().or(z.literal("")),
  listingUrl: z.string().url().optional().or(z.literal("")),
  frequencyMinutes: z.coerce.number().int().min(5).max(1440),
  priority: z.nativeEnum(Priority),
  isActive: z.coerce.boolean(),
  keywords: z.string().optional(),
  allowedUrlPatterns: z.string().optional(),
  excludedUrlPatterns: z.string().optional(),
  monitorCategories: z.array(z.nativeEnum(ContentCategory)).optional(),
});

function splitLines(v?: string): string[] {
  if (!v) return [];
  return v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type SourceActionState = { error?: string; ok?: boolean; id?: string };

export async function saveSource(_prev: SourceActionState, formData: FormData): Promise<SourceActionState> {
  try {
    await requirePermission("sources:write");
  } catch (e) {
    if (e instanceof AuthError) return { error: "Not authorized." };
    throw e;
  }

  const id = (formData.get("id") as string) || null;
  const categories = formData.getAll("monitorCategories") as ContentCategory[];
  const parsed = sourceSchema.safeParse({
    name: formData.get("name"),
    organizationId: formData.get("organizationId") || null,
    state: formData.get("state") || null,
    websiteUrl: formData.get("websiteUrl") || "",
    monitorUrl: formData.get("monitorUrl"),
    type: formData.get("type"),
    rssUrl: formData.get("rssUrl") || "",
    sitemapUrl: formData.get("sitemapUrl") || "",
    listingUrl: formData.get("listingUrl") || "",
    frequencyMinutes: formData.get("frequencyMinutes"),
    priority: formData.get("priority"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    keywords: (formData.get("keywords") as string) || "",
    allowedUrlPatterns: (formData.get("allowedUrlPatterns") as string) || "",
    excludedUrlPatterns: (formData.get("excludedUrlPatterns") as string) || "",
    monitorCategories: categories,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const d = parsed.data;
  const data = {
    name: d.name,
    organizationId: d.organizationId || null,
    state: d.state || null,
    websiteUrl: d.websiteUrl || null,
    monitorUrl: d.monitorUrl,
    type: d.type,
    rssUrl: d.rssUrl || null,
    sitemapUrl: d.sitemapUrl || null,
    listingUrl: d.listingUrl || null,
    frequencyMinutes: d.frequencyMinutes,
    priority: d.priority,
    isActive: d.isActive,
    keywords: splitLines(d.keywords),
    allowedUrlPatterns: splitLines(d.allowedUrlPatterns),
    excludedUrlPatterns: splitLines(d.excludedUrlPatterns),
    monitorCategories: d.monitorCategories ?? [],
  };

  let sourceId: string;
  if (id) {
    const updated = await prisma.source.update({ where: { id }, data });
    sourceId = updated.id;
    await writeAudit("source.update", "Source", id);
  } else {
    const created = await prisma.source.create({ data: { ...data, nextCrawlAt: new Date() } });
    sourceId = created.id;
    await writeAudit("source.create", "Source", created.id);
  }

  revalidatePath("/admin/sources");
  return { ok: true, id: sourceId };
}

export async function toggleSource(id: string, isActive: boolean) {
  await requirePermission("sources:write");
  await prisma.source.update({ where: { id }, data: { isActive } });
  await writeAudit(isActive ? "source.enable" : "source.disable", "Source", id);
  revalidatePath("/admin/sources");
}

export async function deleteSource(id: string) {
  await requirePermission("sources:write");
  await prisma.source.delete({ where: { id } });
  await writeAudit("source.delete", "Source", id);
  revalidatePath("/admin/sources");
}

/** Trigger an immediate crawl of a source (enqueues a job). */
export async function crawlNow(id: string) {
  await requirePermission("sources:write");
  await enqueue("CRAWL_SOURCE", { sourceId: id }, { dedupeKey: `crawl:${id}` });
  await prisma.source.update({ where: { id }, data: { nextCrawlAt: new Date() } });
  await writeAudit("source.crawl_now", "Source", id);
  revalidatePath(`/admin/sources/${id}`);
}
