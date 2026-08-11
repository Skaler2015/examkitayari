"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Input, Label, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createManualPost, type ManualState } from "@/server/actions/ingest";

const TYPES = [
  { key: "url", label: "From URL" },
  { key: "pdf", label: "Upload PDF" },
  { key: "image", label: "Upload Image" },
  { key: "text", label: "Write manually" },
] as const;

const CATEGORIES = ["", "JOB", "ADMIT_CARD", "RESULT", "ANSWER_KEY", "EXAM_DATE", "CUTOFF", "NOTICE", "SYLLABUS", "CURRENT_AFFAIRS", "OTHER"];

export function NewPostForm() {
  const [type, setType] = useState<(typeof TYPES)[number]["key"]>("url");
  const [state, formAction] = useFormState<ManualState, FormData>(createManualPost, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="type" value={type} />

      {/* Input type selector */}
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            type="button"
            key={t.key}
            onClick={() => setType(t.key)}
            className={
              type === t.key
                ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-full border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {state.error && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-400">
          {state.error}
        </p>
      )}

      {type === "url" && (
        <div className="space-y-1.5">
          <Label htmlFor="url">Notification / page URL</Label>
          <Input id="url" name="url" type="url" placeholder="https://…official-notification" />
          <p className="text-xs text-muted-foreground">The page or PDF is fetched, extracted and drafted automatically.</p>
        </div>
      )}

      {(type === "pdf" || type === "image") && (
        <div className="space-y-1.5">
          <Label htmlFor="file">{type === "pdf" ? "PDF file" : "Image file"}</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept={type === "pdf" ? "application/pdf" : "image/*"}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Max 15 MB. {type === "image" ? "Images require OCR to be enabled." : "Scanned PDFs use OCR if enabled."}
          </p>
        </div>
      )}

      {type === "text" && (
        <div className="space-y-1.5">
          <Label htmlFor="body">Content</Label>
          <Textarea id="body" name="body" rows={8} placeholder="Paste or type the notification details…" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title {type === "url" ? "(optional)" : ""}</Label>
          <Input id="title" name="title" placeholder="e.g. SSC CGL 2026 Recruitment" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Category (optional — auto-detected if blank)</Label>
          <select id="category" name="category" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c || "Auto-detect"}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="officialUrl">Official source URL (optional)</Label>
        <Input id="officialUrl" name="officialUrl" type="url" placeholder="https://…official-site (shown as the source link)" />
      </div>

      <SubmitButton pendingLabel="Processing… (extracting + AI draft)">Create draft</SubmitButton>
      <p className="text-xs text-muted-foreground">
        The system extracts data, classifies and generates an AI draft, then opens it for you to edit and publish.
      </p>
    </form>
  );
}
