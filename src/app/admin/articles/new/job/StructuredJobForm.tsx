"use client";

import { useFormState } from "react-dom";
import { Input, Label, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createStructuredJob, type JobState } from "@/server/actions/ingest";

function Field({ name, label, type = "text", placeholder, full }: { name: string; label: string; type?: string; placeholder?: string; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} />
    </div>
  );
}

export function StructuredJobForm() {
  const [state, formAction] = useFormState<JobState, FormData>(createStructuredJob, {});

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-400">{state.error}</p>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Basics</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="title" label="Post Title *" placeholder="e.g. IBPS Clerk 16th Recruitment 2026" full />
          <Field name="organization" label="Organisation" placeholder="e.g. IBPS" />
          <Field name="recruitmentName" label="Recruitment Name" placeholder="e.g. CRP Clerks XVI" />
          <Field name="postName" label="Post Name" placeholder="e.g. Clerk" />
          <Field name="vacancyCount" label="Total Vacancies" placeholder="e.g. 6000" />
          <Field name="vacancyDetail" label="Vacancy Details (category-wise)" placeholder="e.g. UR 2400, OBC 1620…" full />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Important Dates</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="applicationStart" label="Application Start" type="date" />
          <Field name="applicationEnd" label="Last Date to Apply" type="date" />
          <Field name="examDate" label="Exam Date" type="date" />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Eligibility & Pay</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="qualification" label="Qualification" placeholder="e.g. Graduate in any discipline" full />
          <Field name="ageLimit" label="Age Limit" placeholder="e.g. 20 to 28 years" />
          <Field name="ageRelaxation" label="Age Relaxation" placeholder="e.g. OBC 3 yrs, SC/ST 5 yrs" />
          <Field name="applicationFee" label="Application Fee" placeholder="e.g. Gen ₹850 / SC-ST ₹175" />
          <Field name="salary" label="Salary / Pay Scale" placeholder="e.g. ₹19,900 – ₹47,920" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="selectionProcess">Selection Process</Label>
          <Textarea id="selectionProcess" name="selectionProcess" rows={2} placeholder="e.g. Prelims, Mains, Language Proficiency Test" />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Official Links</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="applyOnlineUrl" label="Apply Online URL" type="url" placeholder="https://…" />
          <Field name="officialNotificationUrl" label="Notification PDF URL" type="url" placeholder="https://…" />
          <Field name="officialWebsite" label="Official Website" type="url" placeholder="https://…" full />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="importantInstructions">Important Instructions</Label>
          <Textarea id="importantInstructions" name="importantInstructions" rows={2} />
        </div>
      </section>

      <SubmitButton pendingLabel="Creating draft…">Create detailed Job draft</SubmitButton>
      <p className="text-xs text-muted-foreground">
        A detailed, sectioned post (with dates/fee/vacancy tables, how-to-apply and links) is built from these fields and
        opened as a draft to review and publish. Blank fields show “Not Available in Official Source”.
      </p>
    </form>
  );
}
