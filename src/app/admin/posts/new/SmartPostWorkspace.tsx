"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardContent, Input, Label, Textarea } from "@/components/ui";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { analyzeSource, generateContent, createSmartPost, type SaveState } from "@/server/actions/smartpost";
import { slugify } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const CATEGORIES: { value: string; label: string; path: string }[] = [
  { value: "JOB", label: "Job / Recruitment", path: "jobs" },
  { value: "ADMIT_CARD", label: "Admit Card", path: "admit-card" },
  { value: "RESULT", label: "Result", path: "results" },
  { value: "ANSWER_KEY", label: "Answer Key", path: "answer-key" },
  { value: "EXAM_DATE", label: "Exam Date", path: "exam-dates" },
  { value: "CUTOFF", label: "Cut Off", path: "cutoffs" },
  { value: "MERIT_LIST", label: "Merit List", path: "merit-list" },
  { value: "SYLLABUS", label: "Syllabus", path: "syllabus" },
  { value: "EXAM_PATTERN", label: "Exam Pattern", path: "exam-pattern" },
  { value: "COUNSELLING", label: "Counselling", path: "counselling" },
  { value: "DOCUMENT_VERIFICATION", label: "Document Verification", path: "document-verification" },
  { value: "CURRENT_AFFAIRS", label: "Current Affairs", path: "current-affairs" },
  { value: "NOTICE", label: "Notice", path: "notices" },
  { value: "OTHER", label: "Other Update", path: "updates" },
];

const PATH_OF: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.path]));

type F = { name: string; label: string; type?: "text" | "date" | "url" | "textarea" | "select"; options?: string[]; placeholder?: string; full?: boolean };

const FIELDS: Record<string, F[]> = {
  JOB: [
    { name: "organization", label: "Organisation / Department", placeholder: "e.g. Staff Selection Commission" },
    { name: "recruitmentName", label: "Recruitment Name", placeholder: "e.g. SSC CGL 2026" },
    { name: "postName", label: "Post Name(s)", placeholder: "e.g. Assistant, Inspector" },
    { name: "vacancyCount", label: "Total Vacancies", placeholder: "e.g. 14582" },
    { name: "vacancyDetail", label: "Vacancy Break-up", type: "textarea", full: true, placeholder: "Post-wise / category-wise vacancy details" },
    { name: "applicationStart", label: "Application Start", type: "date" },
    { name: "applicationEnd", label: "Last Date to Apply", type: "date" },
    { name: "examDate", label: "Exam Date", type: "date" },
    { name: "applicationFee", label: "Application Fee", type: "textarea", placeholder: "General/OBC ₹100; SC/ST/PwD/Women exempted" },
    { name: "salary", label: "Salary / Pay Scale", placeholder: "e.g. Level-6 ₹35,400–1,12,400" },
    { name: "qualification", label: "Educational Qualification", type: "textarea", full: true },
    { name: "ageLimit", label: "Age Limit", placeholder: "e.g. 18–30 years" },
    { name: "ageRelaxation", label: "Age Relaxation", type: "textarea" },
    { name: "selectionProcess", label: "Selection Process", type: "textarea", full: true },
    { name: "importantInstructions", label: "Important Instructions", type: "textarea", full: true },
    { name: "officialNotificationUrl", label: "Notification PDF URL", type: "url" },
    { name: "applyOnlineUrl", label: "Apply Online URL", type: "url" },
    { name: "officialWebsite", label: "Official Website", type: "url" },
  ],
  ADMIT_CARD: [
    { name: "examName", label: "Exam Name", placeholder: "e.g. SSC CGL Tier-I" },
    { name: "post", label: "Post", placeholder: "e.g. Assistant" },
    { name: "releaseDate", label: "Admit Card Release Date", type: "date" },
    { name: "examDate", label: "Exam Date", type: "date" },
    { name: "examShift", label: "Exam Shift / Timing" },
    { name: "examCityInfo", label: "Exam City / Centre Info", type: "textarea", full: true },
    { name: "downloadUrl", label: "Download Admit Card URL", type: "url", full: true },
  ],
  RESULT: [
    { name: "examName", label: "Exam Name" },
    { name: "releaseDate", label: "Result Date", type: "date" },
    { name: "resultType", label: "Result Type", placeholder: "e.g. Final / Tier-I / Prelims" },
    { name: "resultUrl", label: "Check Result URL", type: "url" },
    { name: "scorecardUrl", label: "Download Scorecard URL", type: "url" },
  ],
  ANSWER_KEY: [
    { name: "examName", label: "Exam Name" },
    { name: "examDate", label: "Exam Date", type: "date" },
    { name: "keyType", label: "Key Type", type: "select", options: ["", "Provisional", "Final"] },
    { name: "objectionStart", label: "Objection Window Start", type: "date" },
    { name: "objectionEnd", label: "Objection Window End", type: "date" },
    { name: "answerKeyUrl", label: "Answer Key URL", type: "url" },
    { name: "responseSheetUrl", label: "Response Sheet URL", type: "url" },
  ],
  NOTICE: [{ name: "fileUrl", label: "Notice PDF URL", type: "url", full: true }],
};

const KEY_DATE: Record<string, string> = { JOB: "applicationEnd", ADMIT_CARD: "releaseDate", RESULT: "releaseDate", ANSWER_KEY: "examDate" };

const DRAFT_KEY = "smartpost-draft-v1";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Link = { label: string; url: string };
type Store = { fields: Record<string, string>; category: string; body: string; links: Link[] };

function daysBetween(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SmartPostWorkspace({ canPublish }: { canPublish: boolean }) {
  const [category, setCategory] = useState("JOB");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Link[]>([
    { label: "Apply Online", url: "" },
    { label: "Official Notification (PDF)", url: "" },
    { label: "Official Website", url: "" },
  ]);
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  // Smart import
  const [importUrl, setImportUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPending, startImport] = useTransition();
  const [importMsg, setImportMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [analysis, setAnalysis] = useState<{ confidence: number; ocrUsed?: boolean; preview: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Generate + save
  const [genPending, startGen] = useTransition();
  const [savePending, startSave] = useTransition();
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const [restored, setRestored] = useState(false);

  const set = useCallback((name: string, value: string) => setFields((p) => ({ ...p, [name]: value })), []);

  /* ---- autosave (localStorage) ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Store;
        if (s.fields && Object.keys(s.fields).length) {
          setFields(s.fields);
          setCategory(s.category || "JOB");
          setBody(s.body || "");
          if (Array.isArray(s.links) && s.links.length) setLinks(s.links);
          setRestored(true);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ fields, category, body, links } satisfies Store));
      } catch {
        /* ignore */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [fields, category, body, links]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setFields({});
    setBody("");
    setLinks([
      { label: "Apply Online", url: "" },
      { label: "Official Notification (PDF)", url: "" },
      { label: "Official Website", url: "" },
    ]);
    setRestored(false);
    setSaveState(null);
  };

  /* ---- build FormData for the create/generate actions ---- */
  const buildForm = useCallback(
    (extra: Record<string, string> = {}) => {
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => fd.set(k, v ?? ""));
      fd.set("category", category);
      fd.set("officialUrl", fields.officialUrl ?? "");
      fd.set("officialSource", fields.officialSource ?? "");
      fd.set("shortSummary", fields.shortSummary ?? "");
      fd.set("title", fields.title ?? "");
      fd.set("body", body);
      fd.set("links", JSON.stringify(links.filter((l) => l.url.trim())));
      Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
      return fd;
    },
    [fields, category, body, links]
  );

  /* ---- Smart Import ---- */
  const runImport = (mode: "url" | "pdf") => {
    setImportMsg(null);
    const fd = new FormData();
    fd.set("mode", mode);
    if (mode === "url") {
      if (!/^https?:\/\//i.test(importUrl.trim())) {
        setImportMsg({ type: "error", text: "Paste the full official notification/page URL (starting with https://)." });
        return;
      }
      fd.set("url", importUrl.trim());
    } else {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        setImportMsg({ type: "error", text: "Choose a PDF file to import." });
        return;
      }
      fd.set("file", file);
    }
    startImport(async () => {
      const res = await analyzeSource({}, fd);
      if (res.error || !res.result) {
        setImportMsg({ type: "error", text: res.error ?? "Could not analyze the source." });
        return;
      }
      const r = res.result;
      // Merge extracted fields into the form (don't overwrite what the admin typed).
      setCategory(r.category);
      setFields((p) => {
        const next = { ...p };
        const put = (k: string, v?: string) => {
          if (v && !next[k]?.trim()) next[k] = v;
        };
        put("title", r.title);
        put("officialUrl", r.officialUrl);
        put("officialSource", r.officialSource);
        Object.entries(r.fields).forEach(([k, v]) => put(k, v));
        return next;
      });
      // Seed notification link if empty.
      if (r.officialUrl) {
        setLinks((p) => p.map((l) => (/notification/i.test(l.label) && !l.url ? { ...l, url: r.officialUrl } : l)));
      }
      setAnalysis({ confidence: r.confidence, ocrUsed: r.ocrUsed, preview: r.textPreview });
      setImportMsg({ type: "ok", text: `Imported & auto-filled. Detected: ${labelOf(r.category)} (${r.confidence}% match). Please verify every field against the official source.` });
    });
  };

  /* ---- Generate content ---- */
  const runGenerate = () => {
    if (!fields.title?.trim()) {
      setImportMsg({ type: "error", text: "Add a title first, then Generate Content." });
      return;
    }
    startGen(async () => {
      const res = await generateContent({}, buildForm());
      if (res.error) {
        setImportMsg({ type: "error", text: res.error });
        return;
      }
      if (res.body) setBody(res.body);
      if (res.shortSummary && !fields.shortSummary?.trim()) set("shortSummary", res.shortSummary);
    });
  };

  /* ---- Save / Publish / Schedule ---- */
  const runSave = useCallback(
    (action: "draft" | "publish" | "schedule", confirmDuplicate = false) => {
      if (!fields.title?.trim()) {
        setSaveState({ error: "Title is required." });
        return;
      }
      const extra: Record<string, string> = { action };
      if (action === "schedule") extra.scheduledFor = scheduledFor;
      if (confirmDuplicate) extra.confirmDuplicate = "1";
      startSave(async () => {
        const res = await createSmartPost({}, buildForm(extra));
        setSaveState(res);
        if (res.ok) {
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {
            /* ignore */
          }
        }
      });
    },
    [fields.title, scheduledFor, buildForm]
  );

  /* ---- keyboard shortcuts ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "s") {
        e.preventDefault();
        runSave("draft");
      } else if (e.key === "Enter" && canPublish) {
        e.preventDefault();
        runSave("publish");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runSave, canPublish]);

  /* ---- derived ---- */
  const slug = fields.title ? slugify(fields.title) : "";
  const catFields = FIELDS[category] ?? [];
  const keyDateName = KEY_DATE[category];
  const keyDays = keyDateName ? daysBetween(fields[keyDateName]) : null;

  const checklist = useMemo(() => {
    const items = [
      { label: "Title", done: !!fields.title?.trim() },
      { label: "Category", done: !!category },
      { label: "Official source URL", done: !!fields.officialUrl?.trim() },
      { label: "Key date", done: keyDateName ? !!fields[keyDateName]?.trim() : true },
      { label: "At least one link", done: links.some((l) => l.url.trim()) },
      { label: "Content body", done: body.replace(/<[^>]+>/g, "").trim().length > 60 },
      { label: "Short summary", done: !!fields.shortSummary?.trim() },
    ];
    return items;
  }, [fields, category, keyDateName, links, body]);

  const completion = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);

  const metaTitle = (fields.title || "New Post") + " | ExamsKiTayari.com";
  const metaDesc = fields.shortSummary || (body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 155));
  const ogSrc = `/api/og?title=${encodeURIComponent(fields.title || "ExamsKiTayari")}&category=${category}`;

  const busy = importPending || genPending || savePending;

  /* ---- success screen ---- */
  if (saveState?.ok) {
    const publicPath = saveState.publicPath ?? "/";
    return (
      <main className="mx-auto max-w-2xl p-4 sm:p-8">
        <Card>
          <CardContent className="pt-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-500/15">✓</div>
            <h1 className="text-xl font-bold">
              {saveState.status === "PUBLISHED" ? "Post published" : saveState.status === "SCHEDULED" ? "Post scheduled" : "Draft saved"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {saveState.status === "PUBLISHED"
                ? "Your post is now live on ExamsKiTayari.com."
                : saveState.status === "SCHEDULED"
                  ? "It will be published automatically at the scheduled time."
                  : "Saved as a draft. You can publish it later."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {saveState.status === "PUBLISHED" && (
                <Link href={publicPath} target="_blank">
                  <Button>View live post ↗</Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => { clearDraft(); setSaveState(null); }}>
                Create another post
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="pb-24 lg:pb-0">
      {/* ---- Sticky action bar ---- */}
      <div className="sticky top-14 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{fields.title || "New Post"}</p>
              <p className="text-xs text-muted-foreground">{labelOf(category)} · Draft</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <Badge variant={completion >= 80 ? "success" : completion >= 50 ? "warning" : "secondary"}>{completion}% complete</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => runSave("draft")} disabled={busy}>
              {savePending ? "Saving…" : "Save Draft"}
            </Button>
            {canPublish && (
              <Button size="sm" onClick={() => runSave("publish")} disabled={busy}>
                {savePending ? "Publishing…" : "Publish"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px]">
        {/* ================= MAIN ================= */}
        <div className="min-w-0 space-y-6">
          {restored && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <span>Restored your unsaved draft.</span>
              <button className="font-medium underline" onClick={clearDraft} type="button">
                Discard
              </button>
            </div>
          )}

          {saveState?.error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <p>{saveState.error}</p>
              {saveState.duplicate && (
                <Button size="sm" variant="danger" className="mt-2" onClick={() => runSave(canPublish ? "publish" : "draft", true)} disabled={busy}>
                  Yes, this is a different post — continue
                </Button>
              )}
            </div>
          )}

          {/* ---- Smart Import ---- */}
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div>
                <h2 className="text-base font-bold">⚡ Smart Import</h2>
                <p className="text-xs text-muted-foreground">1 Official Notification → a complete ExamsKiTayari post. Paste the official URL or upload the PDF; we read it and auto-fill the fields for you to verify.</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="https://…  official notification / page / PDF URL"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runImport("url"))}
                />
                <Button variant="accent" onClick={() => runImport("url")} disabled={importPending} className="shrink-0">
                  {importPending ? "Analyzing…" : "Fetch & Analyze"}
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm" />
                <Button variant="outline" onClick={() => runImport("pdf")} disabled={importPending} className="shrink-0">
                  Import PDF
                </Button>
              </div>

              {importPending && (
                <div className="space-y-1.5 rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
                  <p>• Fetching source…</p>
                  <p>• Extracting text {analysis?.ocrUsed ? "(OCR)" : ""}…</p>
                  <p>• Detecting post type &amp; pulling fields…</p>
                </div>
              )}

              {importMsg && (
                <div className={`rounded-md px-3 py-2 text-xs ${importMsg.type === "error" ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
                  {importMsg.text}
                </div>
              )}

              {analysis && (
                <div className="rounded-md border p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={analysis.confidence >= 60 ? "success" : "warning"}>Match confidence: {analysis.confidence}%</Badge>
                    {analysis.ocrUsed && <Badge variant="secondary">OCR used</Badge>}
                    <button type="button" className="ml-auto underline" onClick={() => setShowPreview((v) => !v)}>
                      {showPreview ? "Hide" : "Show"} extracted text
                    </button>
                  </div>
                  {showPreview && <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-muted-foreground">{analysis.preview}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ---- Post type + category ---- */}
          <Card>
            <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="category">Post Type</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="officialSource">Official Source (Dept / Board)</Label>
                <Input id="officialSource" value={fields.officialSource ?? ""} onChange={(e) => set("officialSource", e.target.value)} placeholder="e.g. SSC, RSMSSB, UPSC" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* ---- Basic info ---- */}
          <Card>
            <CardContent className="space-y-4 pt-5">
              <h2 className="text-base font-bold">Basic Information</h2>
              <div>
                <Label htmlFor="title">Post Title *</Label>
                <Input id="title" value={fields.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. SSC CGL 2026 Notification: 14582 Posts, Apply Online" className="mt-1" />
                {slug && <p className="mt-1 text-xs text-muted-foreground">URL: /{PATH_OF[category]}/{slug}</p>}
              </div>
              <div>
                <Label htmlFor="officialUrl">Official Source URL</Label>
                <Input id="officialUrl" type="url" value={fields.officialUrl ?? ""} onChange={(e) => set("officialUrl", e.target.value)} placeholder="https://… official page or notification" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="shortSummary">Short Summary</Label>
                <Textarea id="shortSummary" value={fields.shortSummary ?? ""} onChange={(e) => set("shortSummary", e.target.value)} placeholder="1–2 line summary shown on cards and in search results." className="mt-1" rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* ---- Dynamic fields ---- */}
          {catFields.length > 0 && (
            <Card>
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">{labelOf(category)} Details</h2>
                  {keyDays != null && (
                    <Badge variant={keyDays < 0 ? "danger" : keyDays <= 7 ? "warning" : "success"}>
                      {keyDays < 0 ? "Date passed" : keyDays === 0 ? "Today" : `${keyDays} day${keyDays === 1 ? "" : "s"} left`}
                    </Badge>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {catFields.map((f) => (
                    <FieldInput key={f.name} f={f} value={fields[f.name] ?? ""} onChange={(v) => set(f.name, v)} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ---- Important links ---- */}
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Important Links</h2>
                <Button variant="ghost" size="sm" onClick={() => setLinks((p) => [...p, { label: "", url: "" }])}>
                  + Add link
                </Button>
              </div>
              {links.map((l, i) => {
                const invalid = l.url.trim() !== "" && !/^https?:\/\//i.test(l.url.trim());
                return (
                  <div key={i} className="flex flex-col gap-2 sm:flex-row">
                    <Input placeholder="Label (e.g. Apply Online)" value={l.label} onChange={(e) => setLinks((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="sm:w-1/3" />
                    <div className="flex-1">
                      <Input placeholder="https://…" value={l.url} onChange={(e) => setLinks((p) => p.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className={invalid ? "border-red-400" : ""} />
                      {invalid && <p className="mt-1 text-xs text-red-600">Link must start with http:// or https://</p>}
                    </div>
                    <button type="button" onClick={() => setLinks((p) => p.filter((_, j) => j !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border text-muted-foreground hover:bg-secondary" title="Remove">
                      ✕
                    </button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* ---- Content ---- */}
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Post Content</h2>
                <Button variant="accent" size="sm" onClick={runGenerate} disabled={genPending}>
                  {genPending ? "Generating…" : "✨ Generate Content"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Auto-build a detailed, sectioned post (overview, tables, how-to-apply, FAQ) from the fields above — then edit anything you like.</p>
              <RichTextEditor name="body" value={body} onChange={setBody} />
            </CardContent>
          </Card>

          {/* ---- SEO + thumbnail ---- */}
          <Card>
            <CardContent className="space-y-4 pt-5">
              <h2 className="text-base font-bold">SEO &amp; Preview</h2>
              <div className="rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground">Google preview</p>
                <p className="mt-1 truncate text-[13px] text-emerald-700 dark:text-emerald-400">examskitayari.com › {PATH_OF[category]} › {slug || "your-post"}</p>
                <p className="truncate text-[18px] text-[#1a0dab] dark:text-[#8ab4f8]">{metaTitle}</p>
                <p className="line-clamp-2 text-[13px] text-muted-foreground">{metaDesc || "Add a short summary to control how this appears in search results."}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Social / thumbnail image (auto-generated)</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ogSrc} alt="Thumbnail preview" className="w-full max-w-md rounded-md border" width={1200} height={630} />
              </div>
            </CardContent>
          </Card>

          {/* ---- Schedule ---- */}
          {canPublish && (
            <Card>
              <CardContent className="space-y-3 pt-5">
                <h2 className="text-base font-bold">Schedule (optional)</h2>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="sm:w-64" />
                  <Button variant="outline" onClick={() => runSave("schedule")} disabled={busy || !scheduledFor}>
                    Schedule Publish
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">The post auto-publishes at the chosen time via the site’s cron.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ================= SMART ASSISTANT ================= */}
        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Post Health</h3>
                <span className="text-sm font-bold">{completion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className={`h-full transition-all ${completion >= 80 ? "bg-emerald-500" : completion >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${completion}%` }} />
              </div>
              <ul className="space-y-1.5 text-sm">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    <span className={c.done ? "text-emerald-600" : "text-muted-foreground"}>{c.done ? "✓" : "○"}</span>
                    <span className={c.done ? "" : "text-muted-foreground"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 pt-5">
              <h3 className="text-sm font-bold">Quick Actions</h3>
              <Button variant="accent" size="sm" className="w-full" onClick={runGenerate} disabled={genPending}>
                ✨ Generate Content
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={() => runSave("draft")} disabled={busy}>
                💾 Save Draft
              </Button>
              {canPublish && (
                <Button size="sm" className="w-full" onClick={() => runSave("publish")} disabled={busy}>
                  🚀 Publish Now
                </Button>
              )}
            </CardContent>
          </Card>

          {analysis && (
            <Card>
              <CardContent className="space-y-2 pt-5">
                <h3 className="text-sm font-bold">Data Confidence</h3>
                <p className="text-xs text-muted-foreground">Auto-extracted at {analysis.confidence}% match. Fields left blank were not found in the source — fill them from the official notification, never guess.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-1 pt-5 text-xs text-muted-foreground">
              <h3 className="text-sm font-bold text-foreground">Shortcuts</h3>
              <p><kbd className="rounded border px-1">Ctrl</kbd> + <kbd className="rounded border px-1">S</kbd> — Save draft</p>
              {canPublish && <p><kbd className="rounded border px-1">Ctrl</kbd> + <kbd className="rounded border px-1">Enter</kbd> — Publish</p>}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* ---- Mobile sticky bottom bar ---- */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t bg-card p-3 lg:hidden">
        <Badge variant={completion >= 80 ? "success" : "secondary"}>{completion}%</Badge>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => runSave("draft")} disabled={busy}>
          Save
        </Button>
        {canPublish && (
          <Button size="sm" className="flex-1" onClick={() => runSave("publish")} disabled={busy}>
            Publish
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function FieldInput({ f, value, onChange }: { f: F; value: string; onChange: (v: string) => void }) {
  const wrap = f.full ? "sm:col-span-2" : "";
  const urlInvalid = f.type === "url" && value.trim() !== "" && !/^https?:\/\//i.test(value.trim());
  return (
    <div className={wrap}>
      <Label htmlFor={f.name}>{f.label}</Label>
      {f.type === "textarea" ? (
        <Textarea id={f.name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} className="mt-1" rows={2} />
      ) : f.type === "select" ? (
        <select id={f.name} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o || "— select —"}
            </option>
          ))}
        </select>
      ) : (
        <Input id={f.name} type={f.type === "date" ? "date" : f.type === "url" ? "url" : "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} className={`mt-1 ${urlInvalid ? "border-red-400" : ""}`} />
      )}
      {urlInvalid && <p className="mt-1 text-xs text-red-600">Must start with http:// or https://</p>}
    </div>
  );
}

function labelOf(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}
