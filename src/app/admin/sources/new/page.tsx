import Link from "next/link";
import { SectionTitle, Card, CardContent } from "@/components/ui";
import SourceForm from "../SourceForm";

export default function NewSourcePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/sources" className="text-sm text-muted-foreground hover:underline">
          ← Back to sources
        </Link>
        <SectionTitle title="Add Source" className="mt-1" />
      </div>
      <Card>
        <CardContent className="p-4 sm:p-6">
          <SourceForm />
        </CardContent>
      </Card>
    </div>
  );
}
