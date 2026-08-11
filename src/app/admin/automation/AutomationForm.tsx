"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { saveAutomationSettings } from "@/server/actions/automation";

export type AutomationFlags = {
  sourceMonitoring: boolean;
  aiProcessing: boolean;
  autoClassification: boolean;
  autoDraft: boolean;
  autoPublish: boolean;
  autoSeo: boolean;
  autoSitemap: boolean;
  notifications: boolean;
};

const FLAG_LABELS: { key: keyof AutomationFlags; label: string }[] = [
  { key: "sourceMonitoring", label: "Source monitoring" },
  { key: "aiProcessing", label: "AI processing" },
  { key: "autoClassification", label: "Auto classification" },
  { key: "autoDraft", label: "Auto draft" },
  { key: "autoPublish", label: "Auto publish" },
  { key: "autoSeo", label: "Auto SEO" },
  { key: "autoSitemap", label: "Auto sitemap" },
  { key: "notifications", label: "Notifications" },
];

export default function AutomationForm({
  scope,
  values,
  warnAutoPublish,
}: {
  scope: string;
  values: AutomationFlags;
  warnAutoPublish?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const action = saveAutomationSettings.bind(null, scope);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await action(formData);
          router.refresh();
        })
      }
      className="space-y-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {FLAG_LABELS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={key} defaultChecked={values[key]} className="h-4 w-4" />
            {label}
          </label>
        ))}
      </div>

      {warnAutoPublish && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          Note: Jobs, Admit Cards, Results, Answer Keys &amp; Notices default to manual review for safety.
          Enable auto-publish only if you trust extraction for this category.
        </p>
      )}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
