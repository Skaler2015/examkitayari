import type { Metadata } from "next";
import { CategoryListing } from "@/components/article/CategoryListing";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Results",
    description: "Latest exam results and scorecards, sourced directly from official result pages.",
  };
}

export default function Page({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams.page) || 1;
  return (
    <CategoryListing
      category="RESULT"
      title="Results"
      description="Latest exam results and scorecards, sourced directly from official result pages."
      page={page}
      basePath="/results"
    />
  );
}
