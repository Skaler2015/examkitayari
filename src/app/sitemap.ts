import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { CATEGORY_META } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, "");
  const staticPaths = ["", "/jobs", "/admit-card", "/results", "/answer-key", "/exams", "/syllabus", "/mock-tests", "/current-affairs", "/search"];

  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
    changeFrequency: "hourly",
    priority: p === "" ? 1 : 0.8,
  }));

  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, category: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 5000,
  });
  for (const a of articles) {
    entries.push({
      url: `${base}/${CATEGORY_META[a.category].path}/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  const exams = await prisma.exam.findMany({ select: { slug: true, updatedAt: true }, take: 2000 });
  for (const e of exams) {
    entries.push({ url: `${base}/exams/${e.slug}`, lastModified: e.updatedAt, changeFrequency: "weekly", priority: 0.6 });
  }

  return entries;
}
