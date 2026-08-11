"use client";

import { useFormState } from "react-dom";
import { Input, Label, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
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
        <Label>Body</Label>
        <RichTextEditor name="body" defaultValue={body} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-600">Saved.</p>}

      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save Edits
        </SubmitButton>
        {/* One-click: save the edits and publish (sends publishAfter=on). */}
        <SubmitButton name="publishAfter" value="on" pendingLabel="Publishing…">
          Save &amp; Publish
        </SubmitButton>
      </div>
    </form>
  );
}
