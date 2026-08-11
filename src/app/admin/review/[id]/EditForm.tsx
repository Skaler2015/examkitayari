"use client";

import { useFormState } from "react-dom";
import { Input, Label, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveArticleEdits } from "@/server/actions/review";

type EditState = { error?: string; ok?: boolean };

export default function EditForm({
  articleId,
  title,
  shortSummary,
  body,
}: {
  articleId: string;
  title: string;
  shortSummary: string;
  body: string;
}) {
  const [state, formAction] = useFormState<EditState, FormData>(saveArticleEdits, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="articleId" value={articleId} />

      <div className="space-y-1.5">
        <Label htmlFor="edit-title">Title</Label>
        <Input id="edit-title" name="title" defaultValue={title} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-summary">Short Summary</Label>
        <Textarea id="edit-summary" name="shortSummary" defaultValue={shortSummary} rows={3} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-body">Body (HTML)</Label>
        <Textarea id="edit-body" name="body" defaultValue={body} rows={12} className="font-mono text-xs" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-600">Saved.</p>}

      <SubmitButton variant="outline" pendingLabel="Saving…">
        Save Edits
      </SubmitButton>
    </form>
  );
}
