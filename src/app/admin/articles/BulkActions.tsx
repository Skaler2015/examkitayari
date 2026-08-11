"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { unpublishAllPublished, deleteArticlesByStatus } from "@/server/actions/review";

export function BulkActions({ statusFilter }: { statusFilter?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const filterLabel = statusFilter ?? "ALL";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-secondary/30 p-2">
      <span className="text-xs font-medium text-muted-foreground">Bulk actions:</span>

      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("Take ALL published posts offline (move to Draft)? This clears the public site but keeps the data.")) return;
          start(async () => {
            const n = await unpublishAllPublished();
            setMsg(`${n} post(s) unpublished.`);
            router.refresh();
          });
        }}
      >
        Unpublish all published
      </Button>

      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          const scope = filterLabel === "ALL" ? "ALL articles" : `all ${filterLabel} articles`;
          if (!confirm(`Permanently DELETE ${scope}? This cannot be undone.`)) return;
          if (!confirm(`Are you absolutely sure? This will delete ${scope}.`)) return;
          start(async () => {
            const n = await deleteArticlesByStatus(statusFilter);
            setMsg(`${n} article(s) deleted.`);
            router.refresh();
          });
        }}
      >
        Delete all shown ({filterLabel})
      </Button>

      {msg && <span className="text-xs text-emerald-600 dark:text-emerald-400">{msg}</span>}
    </div>
  );
}
