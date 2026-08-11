import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishStatus } from "@prisma/client";
import { getArticleBySlug } from "@/server/queries";
import { ArticleView } from "@/components/article/ArticleView";

/** Build page metadata from the article + its SEO record. */
export async function articleMetadata(slug: string): Promise<Metadata> {
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Not found" };

  const seo = article.seo;
  const title = seo?.title ?? article.title;
  const description = seo?.description ?? article.shortSummary ?? undefined;

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title: seo?.ogTitle ?? title,
      description: seo?.ogDescription ?? description,
      type: "article",
      ...(seo?.ogImage ? { images: [{ url: seo.ogImage }] } : {}),
    },
    ...(seo?.canonical ? { alternates: { canonical: seo.canonical } } : {}),
  };

  if (seo?.noindex) {
    metadata.robots = { index: false, follow: false };
  }

  return metadata;
}

/** Server component: loads, guards, renders an article + JSON-LD. */
export async function ArticleDetail({ slug }: { slug: string }) {
  const article = await getArticleBySlug(slug);
  if (!article || article.status !== PublishStatus.PUBLISHED) {
    notFound();
  }

  const jsonLd = article.seo?.jsonLd;

  return (
    <>
      {jsonLd != null && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ArticleView article={article} />
    </>
  );
}
