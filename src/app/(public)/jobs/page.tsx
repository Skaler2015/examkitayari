import type { Metadata } from "next";
import { CategoryListing } from "@/components/article/CategoryListing";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Latest Government Jobs",
    description: "Newest recruitment notifications and government job openings, verified from official sources.",
  };
}

export default function Page({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams.page) || 1;
  return (
    <CategoryListing
      category="JOB"
      title="Latest Government Jobs"
      description="Newest recruitment notifications and government job openings, verified from official sources."
      page={page}
      basePath="/jobs"
    />
  );
}
