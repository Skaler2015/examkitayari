export const dynamic = "force-dynamic";
export const maxDuration = 120;

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { DiscoverForm } from "./DiscoverForm";

export default function DiscoverPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin/sources" className="text-sm text-muted-foreground hover:underline">
          ← Back to sources
        </Link>
        <h1 className="mt-2 text-xl font-bold">Discover from sitemap</h1>
        <p className="text-sm text-muted-foreground">
          Import pages from any website&apos;s sitemap for a date range. Each new page is queued, extracted, classified
          and drafted — drafts appear in Pending Review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sitemap import</CardTitle>
        </CardHeader>
        <CardContent>
          <DiscoverForm />
        </CardContent>
      </Card>
    </div>
  );
}
