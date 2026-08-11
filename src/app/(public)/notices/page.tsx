import type { Metadata } from "next";
import { CategoryListing } from "@/components/article/CategoryListing";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Official Notices",
    description: "Important notices and circulars published by exam conducting bodies.",
  };
}

export default function Page({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams.page) || 1;
  return (
    <CategoryListing
      category="NOTICE"
      title="Official Notices"
      description="Important notices and circulars published by exam conducting bodies."
      page={page}
      basePath="/notices"
    />
  );
}
