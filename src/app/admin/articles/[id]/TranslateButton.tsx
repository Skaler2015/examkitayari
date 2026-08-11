"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { translateArticleToHindi } from "@/server/actions/review";

export function TranslateButton({ articleId, hasHindi }: { articleId: string; hasHindi: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await translateArticleToHindi(articleId);
            setMsg(r.ok ? "Hindi translation saved." : r.error ?? "Failed.");
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? "Translating…" : hasHindi ? "Re-translate to Hindi" : "Translate to Hindi"}
      </Button>
      {hasHindi && <span className="text-xs text-emerald-600 dark:text-emerald-400">हिंदी available</span>}
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
