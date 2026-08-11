"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import { SourceType, Priority, ContentCategory, type Source } from "@prisma/client";
import { Input, Label, Textarea } from "@/components/ui";
import { saveSource, type SourceActionState } from "@/server/actions/sources";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function SourceForm({ source }: { source?: Source }) {
  const [state, formAction] = useFormState<SourceActionState, FormData>(saveSource, {});
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.push("/admin/sources");
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-5">
      {source?.id && <input type="hidden" name="id" value={source.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" defaultValue={source?.name ?? ""} required minLength={2} />
        </Field>
        <Field label="Organization ID" hint="Optional — existing organization id.">
          <Input name="organizationId" defaultValue={source?.organizationId ?? ""} />
        </Field>
        <Field label="State" hint="Optional (e.g. Bihar).">
          <Input name="state" defaultValue={source?.state ?? ""} />
        </Field>
        <Field label="Website URL" hint="Optional homepage.">
          <Input name="websiteUrl" type="url" defaultValue={source?.websiteUrl ?? ""} />
        </Field>
        <Field label="Monitor URL" hint="Required — the primary URL that gets polled.">
          <Input name="monitorUrl" type="url" defaultValue={source?.monitorUrl ?? ""} required />
        </Field>
        <Field label="Type">
          <select
            name="type"
            defaultValue={source?.type ?? SourceType.HTML_PAGE}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.values(SourceType).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="RSS URL" hint="Optional.">
          <Input name="rssUrl" type="url" defaultValue={source?.rssUrl ?? ""} />
        </Field>
        <Field label="Sitemap URL" hint="Optional.">
          <Input name="sitemapUrl" type="url" defaultValue={source?.sitemapUrl ?? ""} />
        </Field>
        <Field label="Listing URL" hint="Optional.">
          <Input name="listingUrl" type="url" defaultValue={source?.listingUrl ?? ""} />
        </Field>
        <Field label="Frequency (minutes)" hint="5–1440.">
          <Input
            name="frequencyMinutes"
            type="number"
            min={5}
            max={1440}
            defaultValue={source?.frequencyMinutes ?? 30}
          />
        </Field>
        <Field label="Priority">
          <select
            name="priority"
            defaultValue={source?.priority ?? Priority.NORMAL}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {[Priority.HIGH, Priority.NORMAL, Priority.LOW].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Active">
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={source?.isActive ?? true}
              className="h-4 w-4"
            />
            Source is active (polled on schedule)
          </label>
        </Field>
      </div>

      <Field label="Keywords" hint="Comma or newline separated. Used to match relevant items.">
        <Textarea name="keywords" defaultValue={(source?.keywords ?? []).join("\n")} rows={3} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Allowed URL patterns" hint="Comma/newline separated.">
          <Textarea name="allowedUrlPatterns" defaultValue={(source?.allowedUrlPatterns ?? []).join("\n")} rows={3} />
        </Field>
        <Field label="Excluded URL patterns" hint="Comma/newline separated.">
          <Textarea name="excludedUrlPatterns" defaultValue={(source?.excludedUrlPatterns ?? []).join("\n")} rows={3} />
        </Field>
      </div>

      <Field label="Monitor categories" hint="Content categories this source is expected to produce.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.values(ContentCategory).map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="monitorCategories"
                value={c}
                defaultChecked={source?.monitorCategories?.includes(c) ?? false}
                className="h-4 w-4"
              />
              {c}
            </label>
          ))}
        </div>
      </Field>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">
          {source?.id ? "Save Changes" : "Create Source"}
        </SubmitButton>
      </div>
    </form>
  );
}
