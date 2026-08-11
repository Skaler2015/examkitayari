import type { Metadata } from "next";
import { CategoryListing } from "@/components/article/CategoryListing";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Admit Cards",
    description: "Download links and release updates for exam admit cards and hall tickets.",
  };
}

export default function Page({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams.page) || 1;
  return (
    <CategoryListing
      category="ADMIT_CARD"
      title="Admit Cards"
      description="Download links and release updates for exam admit cards and hall tickets."
      page={page}
      basePath="/admit-card"
    />
  );
}
