import type { Metadata } from "next";
import { CategoryListing } from "@/components/article/CategoryListing";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Latest Updates",
    description: "Other verified exam and recruitment updates from official sources.",
  };
}

export default function Page({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams.page) || 1;
  return (
    <CategoryListing
      category="OTHER"
      title="Latest Updates"
      description="Other verified exam and recruitment updates from official sources."
      page={page}
      basePath="/updates"
    />
  );
}
