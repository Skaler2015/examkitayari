export const dynamic = "force-dynamic";
// Extraction + AI drafting can take a while; give the action room on Vercel Pro.
export const maxDuration = 120;

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { NewPostForm } from "./NewPostForm";

export default function NewPostPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin/articles" className="text-sm text-muted-foreground hover:underline">
          ← Back to articles
        </Link>
        <h1 className="mt-2 text-xl font-bold">Add New Post</h1>
        <p className="text-sm text-muted-foreground">
          Give a URL, upload a notification PDF/image, or write manually — it becomes an editable draft.
        </p>
      </div>

      <div className="rounded-md border bg-secondary/30 p-3 text-sm">
        Want to type a <strong>detailed Job post</strong> by hand (vacancy, dates, fee, eligibility, links)?{" "}
        <Link href="/admin/articles/new/job" className="font-medium text-primary hover:underline">
          Use the structured Job form →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source</CardTitle>
        </CardHeader>
        <CardContent>
          <NewPostForm />
        </CardContent>
      </Card>
    </div>
  );
}
