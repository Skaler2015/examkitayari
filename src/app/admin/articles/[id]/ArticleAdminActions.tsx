"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { approveAndPublish, unpublishArticle, deleteArticle } from "@/server/actions/review";

export function ArticleAdminActions({
  articleId,
  status,
  liveUrl,
}: {
  articleId: string;
  status: string;
  liveUrl: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const isPublished = status === "PUBLISHED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isPublished ? (
        <>
          <a href={liveUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">View live ↗</Button>
          </a>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => start(async () => { await unpublishArticle(articleId); router.refresh(); })}
          >
            Unpublish
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => start(async () => { await approveAndPublish(articleId); router.refresh(); })}
        >
          Publish
        </Button>
      )}

      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this post permanently? This cannot be undone.")) return;
          start(async () => {
            await deleteArticle(articleId);
            router.push("/admin/articles");
          });
        }}
      >
        Delete
      </Button>
    </div>
  );
}
