export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { StructuredJobForm } from "./StructuredJobForm";

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/articles/new" className="text-sm text-muted-foreground hover:underline">
          ← Back to Add New Post
        </Link>
        <h1 className="mt-2 text-xl font-bold">Create detailed Job post</h1>
        <p className="text-sm text-muted-foreground">
          Fill the fields from the official notification — a fully structured post (Important Dates, Fee, Vacancy,
          Eligibility, Age, Salary, Selection Process, How to Apply, Important Links, FAQ) is generated for you to review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
        </CardHeader>
        <CardContent>
          <StructuredJobForm />
        </CardContent>
      </Card>
    </div>
  );
}
