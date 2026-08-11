import type { Metadata } from "next";
import { ArticleDetail, articleMetadata } from "@/components/article/ArticleDetail";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return articleMetadata(params.slug);
}

export default function Page({ params }: { params: { slug: string } }) {
  return <ArticleDetail slug={params.slug} />;
}
