"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { approveAndPublish, rejectArticle, markDuplicate } from "@/server/actions/review";

export default function ReviewActions({ articleId }: { articleId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.push("/admin/review");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="primary"
        disabled={isPending}
        onClick={() => run(() => approveAndPublish(articleId))}
      >
        Approve &amp; Publish
      </Button>
      <Button
        variant="danger"
        disabled={isPending}
        onClick={() => {
          if (confirm("Reject this article?")) run(() => rejectArticle(articleId));
        }}
      >
        Reject
      </Button>
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() => run(() => markDuplicate(articleId))}
      >
        Mark Duplicate
      </Button>
    </div>
  );
}
