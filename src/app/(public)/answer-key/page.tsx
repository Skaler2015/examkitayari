import type { Metadata } from "next";
import { CategoryListing } from "@/components/article/CategoryListing";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Answer Keys",
    description: "Provisional and final answer keys with objection windows and response sheets.",
  };
}

export default function Page({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams.page) || 1;
  return (
    <CategoryListing
      category="ANSWER_KEY"
      title="Answer Keys"
      description="Provisional and final answer keys with objection windows and response sheets."
      page={page}
      basePath="/answer-key"
    />
  );
}
