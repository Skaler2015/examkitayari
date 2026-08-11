"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { crawlNow, toggleSource, deleteSource } from "@/server/actions/sources";

export default function SourceControls({ id, isActive }: { id: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await crawlNow(id);
            router.refresh();
          })
        }
      >
        Crawl Now
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await toggleSource(id, !isActive);
            router.refresh();
          })
        }
      >
        {isActive ? "Disable" : "Enable"}
      </Button>
      <Button
        size="sm"
        variant="danger"
        disabled={isPending}
        onClick={() => {
          if (confirm("Delete this source and all its crawl history? This cannot be undone.")) {
            startTransition(async () => {
              await deleteSource(id);
              router.push("/admin/sources");
              router.refresh();
            });
          }
        }}
      >
        Delete
      </Button>
    </div>
  );
}
