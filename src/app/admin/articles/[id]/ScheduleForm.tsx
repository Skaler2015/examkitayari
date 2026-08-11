"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { scheduleArticle, unscheduleArticle } from "@/server/actions/review";

export function ScheduleForm({ articleId, scheduledFor }: { articleId: string; scheduledFor: string | null }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2">
      {scheduledFor && (
        <p className="text-sm">
          Scheduled for <strong>{new Date(scheduledFor).toLocaleString("en-IN")}</strong>{" "}
          <button
            className="ml-2 text-xs text-red-600 underline"
            disabled={pending}
            onClick={() => start(async () => { await unscheduleArticle(articleId); router.refresh(); })}
          >
            cancel
          </button>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-auto"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !value}
          onClick={() =>
            start(async () => {
              // Convert local input to a full ISO (with the browser's timezone).
              await scheduleArticle(articleId, new Date(value).toISOString());
              router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Schedule publish"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">The article auto-publishes at the chosen time (checked every few minutes).</p>
    </div>
  );
}
