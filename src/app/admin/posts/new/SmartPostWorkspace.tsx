"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Button, Input, Label, Textarea } from "@/components/ui";
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

type F = { name: string; label: string; type?: "text" | "date" | "url" | "textarea" | "select"; options?: string[]; placeholder?: string; full?: boolean; chips?: string[] };

// Non-Job categories render their fields inside the Details card.
const FIELDS: Record<string, F[]> = {
  ADMIT_CARD: [
    { name: "examName", label: "Exam Name" },
    { name: "post", label: "Post" },
    { name: "releaseDate", label: "Admit Card Release Date", type: "date" },
    { name: "examDate", label: "Exam Date", type: "date" },
    { name: "examShift", label: "Exam Shift / Timing" },
    { name: "examCityInfo", label: "Exam City / Centre Info", type: "textarea", full: true },
    { name: "downloadUrl", label: "Download Admit Card URL", type: "url", full: true },
  ],
  RESULT: [
    { name: "examName", label: "Exam Name" },
    { name: "releaseDate", label: "Result Date", type: "date" },
    { name: "resultType", label: "Result Type", placeholder: "Final / Tier-I / Prelims" },
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
const DRAFT_KEY = "smartpost-draft-v2";

type Link = { label: string; url: string };
type Store = { fields: Record<string, string>; category: string; body: string; links: Link[] };

function daysBetween(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}
function labelOf(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

/* ------------------------------------------------------------------ */
/* Small UI atoms                                                      */
/* ------------------------------------------------------------------ */

function SectionCard({ color, icon, title, subtitle, children }: { color: string; icon: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-l-4 bg-card shadow-sm ${color}`}>
      <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        <span className="text-lg">{icon}</span>
        <div>
          <h2 className="text-sm font-bold sm:text-base">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Chips({ items, onPick }: { items: string[]; onPick: (v: string) => void }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {items.map((c) => (
        <button key={c} type="button" onClick={() => onPick(c)} className="rounded-full border bg-secondary/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
          {c}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SmartPostWorkspace({ canPublish, aiEnabled }: { canPublish: boolean; aiEnabled: boolean }) {
  const [category, setCategory] = useState("JOB");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Link[]>([
    { label: "Apply Online", url: "" },
    { label: "Official Notification (PDF)", url: "" },
    { label: "Official Website", url: "" },
  ]);
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [pushNotify, setPushNotify] = useState(true);
  const sourceTextRef = useRef("");

  const [importUrl, setImportUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPending, startImport] = useTransition();
  const [importMsg, setImportMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [analysis, setAnalysis] = useState<{ confidence: number; aiUsed: boolean; ocrUsed?: boolean; preview: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [genPending, startGen] = useTransition();
  const [savePending, startSave] = useTransition();
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const [restored, setRestored] = useState(false);

  const set = useCallback((name: string, value: string) => setFields((p) => ({ ...p, [name]: value })), []);

  /* ---- autosave ---- */
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
    sourceTextRef.current = "";
    setLinks([
      { label: "Apply Online", url: "" },
      { label: "Official Notification (PDF)", url: "" },
      { label: "Official Website", url: "" },
    ]);
    setAnalysis(null);
    setImportMsg(null);
    setRestored(false);
    setSaveState(null);
  };

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
      fd.set("sourceText", sourceTextRef.current);
      fd.set("links", JSON.stringify(links.filter((l) => l.url.trim())));
      Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
      return fd;
    },
    [fields, category, body, links]
  );

  /* ---- Smart Import (AI se poora form bharo) ---- */
  const runImport = (mode: "url" | "pdf") => {
    setImportMsg(null);
    const fd = new FormData();
    fd.set("mode", mode);
    if (mode === "url") {
      if (!/^https?:\/\//i.test(importUrl.trim())) {
        setImportMsg({ type: "error", text: "Official notification/page ka poora URL daalein (https:// se)." });
        return;
      }
      fd.set("url", importUrl.trim());
    } else {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        setImportMsg({ type: "error", text: "Import karne ke liye ek PDF chunein." });
        return;
      }
      fd.set("file", file);
    }
    startImport(async () => {
      const res = await analyzeSource({}, fd);
      if (res.error || !res.result) {
        setImportMsg({ type: "error", text: res.error ?? "Source analyze nahi ho saka." });
        return;
      }
      const r = res.result;
      sourceTextRef.current = r.sourceText || "";
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
      if (r.officialUrl) setLinks((p) => p.map((l) => (/notification/i.test(l.label) && !l.url ? { ...l, url: r.officialUrl } : l)));
      setAnalysis({ confidence: r.confidence, aiUsed: r.aiUsed, ocrUsed: r.ocrUsed, preview: r.textPreview });
      setImportMsg({
        type: "ok",
        text: `${r.aiUsed ? "AI ne padhkar" : "Fields nikaal ke"} form bhar diya — detected: ${labelOf(r.category)}. Publish se pehle har field official source se verify karein.`,
      });
    });
  };

  /* ---- AI se poori post likho ---- */
  const runGenerate = () => {
    if (!fields.title?.trim()) {
      setImportMsg({ type: "error", text: "Pehle title daalein, phir content banayein." });
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
      setImportMsg({ type: "ok", text: res.aiUsed ? "AI ne poori post likh di — neeche edit kar sakte ho." : "Content bana diya (template) — neeche edit kar sakte ho." });
    });
  };

  /* ---- Save / Publish / Schedule ---- */
  const runSave = useCallback(
    (action: "draft" | "publish" | "schedule", confirmDuplicate = false) => {
      if (!fields.title?.trim()) {
        setSaveState({ error: "Title zaroori hai." });
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

  /* ---- shortcuts ---- */
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
  const isJob = category === "JOB";
  const keyDateName = KEY_DATE[category];
  const keyDays = keyDateName ? daysBetween(fields[keyDateName]) : null;

  const progress = useMemo(
    () => [
      { key: "Title", done: !!fields.title?.trim() },
      { key: "Dates", done: !!(fields.applicationStart || fields.applicationEnd || fields.examDate || fields.releaseDate) },
      { key: "Fee", done: !!fields.applicationFee?.trim() },
      { key: "Age", done: !!fields.ageLimit?.trim() },
      { key: "Qualification", done: !!fields.qualification?.trim() },
      { key: "Content", done: body.replace(/<[^>]+>/g, "").trim().length > 60 },
      { key: "Links", done: links.some((l) => l.url.trim()) },
      { key: "Thumbnail", done: !!fields.title?.trim() },
    ],
    [fields, body, links]
  );
  const completion = Math.round((progress.filter((p) => p.done).length / progress.length) * 100);
  const missing = progress.filter((p) => !p.done).map((p) => p.key);

  const metaTitle = (fields.title || "New Post") + " | ExamsKiTayari.com";
  const metaDesc = fields.shortSummary || body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
  const ogSrc = `/api/og?title=${encodeURIComponent(fields.title || "ExamsKiTayari")}&category=${category}`;
  const busy = importPending || genPending || savePending;

  /* ---- success ---- */
  if (saveState?.ok) {
    const publicPath = saveState.publicPath ?? "/";
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-8">
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-500/15">✓</div>
          <h1 className="text-xl font-bold">
            {saveState.status === "PUBLISHED" ? "Post live ho gayi 🎉" : saveState.status === "SCHEDULED" ? "Post schedule ho gayi" : "Draft save ho gaya"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {saveState.status === "PUBLISHED"
              ? `Aapki post ab ExamsKiTayari.com par live hai${saveState.aiUsed ? " (AI ne likhi, aapne verify ki)" : ""}.`
              : saveState.status === "SCHEDULED"
                ? "Chune gaye time par apne aap publish ho jayegi."
                : "Draft save ho gaya — baad me publish kar sakte ho."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {saveState.status === "PUBLISHED" && (
              <Link href={publicPath} target="_blank">
                <Button>View live post ↗</Button>
              </Link>
            )}
            <Button variant="outline" onClick={() => { clearDraft(); setSaveState(null); }}>
              Nayi post banao
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const cat = CATEGORIES.find((c) => c.value === category);

  return (
    <div className="pb-24 lg:pb-0">
      {/* ===== Sticky action bar ===== */}
      <div className="sticky top-14 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{fields.title || "New Post"}</p>
              <p className="text-xs text-muted-foreground">{labelOf(category)} · Draft</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">{completion}% ready</span>
            <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-secondary sm:block">
              <div className={`h-full ${completion >= 80 ? "bg-emerald-500" : completion >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${completion}%` }} />
            </div>
            <Button variant="outline" size="sm" onClick={() => runSave("draft")} disabled={busy}>
              {savePending ? "…" : "Save Draft"}
            </Button>
            {canPublish && (
              <Button size="sm" onClick={() => runSave("publish")} disabled={busy}>
                {savePending ? "…" : "🚀 Publish"}
              </Button>
            )}
          </div>
        </div>
        {/* progress chips */}
        <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 pb-2 sm:px-6">
          {progress.map((p) => (
            <span key={p.key} className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${p.done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-secondary text-muted-foreground"}`}>
              {p.done ? "✓ " : ""}{p.key}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_300px]">
        {/* ================= MAIN ================= */}
        <div className="min-w-0 space-y-5">
          {restored && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <span>📄 Pichla unsaved draft restore kiya.</span>
              <button className="font-medium underline" onClick={clearDraft} type="button">Discard</button>
            </div>
          )}
          {saveState?.error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <p>{saveState.error}</p>
              {saveState.duplicate && (
                <Button size="sm" variant="danger" className="mt-2" onClick={() => runSave(canPublish ? "publish" : "draft", true)} disabled={busy}>
                  Haan, alag post hai — continue
                </Button>
              )}
            </div>
          )}

          {/* ===== Gradient hero: Nayi Post banao ===== */}
          <div className="overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 text-white shadow">
            <div className="p-5 sm:p-6">
              <h1 className="text-lg font-extrabold sm:text-xl">📝 Nayi Post banao</h1>
              <p className="mt-0.5 text-sm text-white/85">
                {aiEnabled ? "PDF ya URL daalo — AI padhkar 90% form khud bhar dega." : "PDF ya URL daalo — fields nikaal ke form bhar dega."}
              </p>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  placeholder="https://ssc.gov.in/notification.pdf — official URL yahan paste karo"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runImport("url"))}
                  className="h-11 flex-1 rounded-lg border-0 bg-white/95 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white"
                />
                <button onClick={() => runImport("url")} disabled={importPending} className="h-11 shrink-0 rounded-lg bg-amber-400 px-5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60">
                  {importPending ? "Padh raha hoon…" : aiEnabled ? "🤖 AI se form bharo" : "Fetch & Fill"}
                </button>
              </div>

              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-1.5 file:text-sm file:text-white" />
                <button onClick={() => runImport("pdf")} disabled={importPending} className="h-9 shrink-0 rounded-lg bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25 disabled:opacity-60">
                  Notification PDF upload karo
                </button>
              </div>

              {importPending && (
                <div className="mt-3 space-y-1 rounded-lg bg-white/10 p-3 text-xs text-white/90">
                  <p>• Source fetch kar raha hoon…</p>
                  <p>• Text nikaal raha hoon {analysis?.ocrUsed ? "(OCR)" : ""}…</p>
                  <p>• {aiEnabled ? "AI se fields bhar raha hoon" : "Fields detect kar raha hoon"}…</p>
                </div>
              )}
            </div>
          </div>

          {importMsg && (
            <div className={`rounded-lg px-4 py-2.5 text-sm ${importMsg.type === "error" ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
              {importMsg.text}
            </div>
          )}

          {analysis && (
            <div className="rounded-lg border p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {analysis.aiUsed && <Badge variant="success">🤖 AI extracted</Badge>}
                <Badge variant={analysis.confidence >= 60 ? "success" : "warning"}>Match: {analysis.confidence}%</Badge>
                {analysis.ocrUsed && <Badge variant="secondary">OCR</Badge>}
                <button type="button" className="ml-auto underline" onClick={() => setShowPreview((v) => !v)}>
                  {showPreview ? "Hide" : "Show"} extracted text
                </button>
              </div>
              {showPreview && <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-muted-foreground">{analysis.preview}</p>}
            </div>
          )}

          {/* ===== Basic / Title ===== */}
          <SectionCard color="border-l-indigo-500" icon="📌" title="Title & Type" subtitle="Post ka type, official source aur headline">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="category">Post Type</Label>
                <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </div>
              <div>
                <Label htmlFor="officialSource">Official Source (Dept / Board)</Label>
                <Input id="officialSource" value={fields.officialSource ?? ""} onChange={(e) => set("officialSource", e.target.value)} placeholder="e.g. SSC, RSMSSB, UPSC" className="mt-1" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="title">Post Title *</Label>
                <button type="button" onClick={runGenerate} disabled={genPending} className="text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-50">
                  {genPending ? "Likh raha hoon…" : aiEnabled ? "🤖 AI se poori post likho" : "✨ Content banao"}
                </button>
              </div>
              <Input id="title" value={fields.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. SBI PO 2026 Notification: 2000 Posts, Apply Online" className="mt-1" />
              {slug && <p className="mt-1 text-xs text-muted-foreground">Final URL: /{PATH_OF[category]}/{slug}</p>}
            </div>
            <div>
              <Label htmlFor="officialUrl">Official Source URL</Label>
              <Input id="officialUrl" type="url" value={fields.officialUrl ?? ""} onChange={(e) => set("officialUrl", e.target.value)} placeholder="https://… official page / notification" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="shortSummary">Short Summary</Label>
              <Textarea id="shortSummary" value={fields.shortSummary ?? ""} onChange={(e) => set("shortSummary", e.target.value)} placeholder="1–2 line summary — cards aur Google search me dikhega." className="mt-1" rows={2} />
            </div>
          </SectionCard>

          {/* ===== Dates & Department (Job) ===== */}
          {isJob && (
            <SectionCard color="border-l-sky-500" icon="📅" title="Dates & Department" subtitle="Department, important dates">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldInput f={{ name: "organization", label: "Organisation / Department", placeholder: "e.g. Staff Selection Commission" }} value={fields.organization ?? ""} onChange={(v) => set("organization", v)} />
                <FieldInput f={{ name: "recruitmentName", label: "Recruitment Name", placeholder: "e.g. SSC CGL 2026" }} value={fields.recruitmentName ?? ""} onChange={(v) => set("recruitmentName", v)} />
                <FieldInput f={{ name: "applicationStart", label: "Application Start", type: "date" }} value={fields.applicationStart ?? ""} onChange={(v) => set("applicationStart", v)} />
                <FieldInput f={{ name: "applicationEnd", label: "Last Date to Apply", type: "date" }} value={fields.applicationEnd ?? ""} onChange={(v) => set("applicationEnd", v)} />
                <FieldInput f={{ name: "examDate", label: "Exam Date", type: "date" }} value={fields.examDate ?? ""} onChange={(v) => set("examDate", v)} />
                {keyDays != null && (
                  <div className="flex items-end">
                    <Badge variant={keyDays < 0 ? "danger" : keyDays <= 7 ? "warning" : "success"}>
                      {keyDays < 0 ? "Last date nikal gayi" : keyDays === 0 ? "Aaj last date" : `${keyDays} din baaki (apply)`}
                    </Badge>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* ===== Details (Job) ===== */}
          {isJob && (
            <SectionCard color="border-l-amber-500" icon="📋" title="Details" subtitle="Fee, age limit, vacancies, qualification">
              <div>
                <Label htmlFor="applicationFee">Application Fee</Label>
                <Textarea id="applicationFee" value={fields.applicationFee ?? ""} onChange={(e) => set("applicationFee", e.target.value)} placeholder="Fee details…" className="mt-1" rows={2} />
                <Chips items={["Gen/OBC ₹100; SC/ST/PwD/Women exempted", "₹250 All", "No Fee"]} onPick={(v) => set("applicationFee", v)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ageLimit">Age Limit</Label>
                  <Input id="ageLimit" value={fields.ageLimit ?? ""} onChange={(e) => set("ageLimit", e.target.value)} placeholder="e.g. 21–30 years" className="mt-1" />
                  <Chips items={["18–27 years", "18–30 years", "21–30 years", "18–40 years"]} onPick={(v) => set("ageLimit", v)} />
                </div>
                <FieldInput f={{ name: "vacancyCount", label: "No. of Posts (Total Vacancies)", placeholder: "e.g. 14582" }} value={fields.vacancyCount ?? ""} onChange={(v) => set("vacancyCount", v)} />
              </div>
              <FieldInput f={{ name: "vacancyDetail", label: "Vacancy Break-up", type: "textarea", placeholder: "Post-wise / category-wise vacancy details" }} value={fields.vacancyDetail ?? ""} onChange={(v) => set("vacancyDetail", v)} />
              <FieldInput f={{ name: "qualification", label: "Educational Qualification", type: "textarea" }} value={fields.qualification ?? ""} onChange={(v) => set("qualification", v)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldInput f={{ name: "salary", label: "Salary / Pay Scale", placeholder: "e.g. Level-6 ₹35,400–1,12,400" }} value={fields.salary ?? ""} onChange={(v) => set("salary", v)} />
                <FieldInput f={{ name: "ageRelaxation", label: "Age Relaxation", type: "textarea" }} value={fields.ageRelaxation ?? ""} onChange={(v) => set("ageRelaxation", v)} />
              </div>
              <FieldInput f={{ name: "selectionProcess", label: "Selection Process", type: "textarea" }} value={fields.selectionProcess ?? ""} onChange={(v) => set("selectionProcess", v)} />
              <div className="grid gap-4 sm:grid-cols-3">
                <FieldInput f={{ name: "officialNotificationUrl", label: "Notification PDF URL", type: "url" }} value={fields.officialNotificationUrl ?? ""} onChange={(v) => set("officialNotificationUrl", v)} />
                <FieldInput f={{ name: "applyOnlineUrl", label: "Apply Online URL", type: "url" }} value={fields.applyOnlineUrl ?? ""} onChange={(v) => set("applyOnlineUrl", v)} />
                <FieldInput f={{ name: "officialWebsite", label: "Official Website", type: "url" }} value={fields.officialWebsite ?? ""} onChange={(v) => set("officialWebsite", v)} />
              </div>
            </SectionCard>
          )}

          {/* ===== Non-job dynamic details ===== */}
          {!isJob && catFields.length > 0 && (
            <SectionCard color="border-l-amber-500" icon="📋" title={`${labelOf(category)} Details`} subtitle="Is post type ke fields">
              <div className="grid gap-4 sm:grid-cols-2">
                {catFields.map((f) => (
                  <FieldInput key={f.name} f={f} value={fields[f.name] ?? ""} onChange={(v) => set(f.name, v)} />
                ))}
              </div>
            </SectionCard>
          )}

          {/* ===== Content & Sections ===== */}
          <SectionCard color="border-l-violet-500" icon="📝" title="Content & Sections" subtitle="Poori post ka content — AI likhega, aap edit karo">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Overview, tables, how-to-apply, FAQ — sab fields se auto ban jayega.</p>
              <button type="button" onClick={runGenerate} disabled={genPending} className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">
                {genPending ? "Likh raha hoon…" : aiEnabled ? "🤖 AI se poori post likho" : "✨ Content banao"}
              </button>
            </div>
            <RichTextEditor name="body" value={body} onChange={setBody} />
            <div>
              <Label htmlFor="additionalInfo">Additional Information (optional)</Label>
              <Textarea id="additionalInfo" value={fields.additionalInfo ?? ""} onChange={(e) => set("additionalInfo", e.target.value)} placeholder="Jo bhi extra likhna ho…" className="mt-1" rows={2} />
            </div>
          </SectionCard>

          {/* ===== Links ===== */}
          <SectionCard color="border-l-teal-500" icon="🔗" title="Links" subtitle="Apply, notification, official website, extra links">
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setLinks((p) => [...p, { label: "", url: "" }])}>+ Add link</Button>
            </div>
            {links.map((l, i) => {
              const invalid = l.url.trim() !== "" && !/^https?:\/\//i.test(l.url.trim());
              return (
                <div key={i} className="flex flex-col gap-2 sm:flex-row">
                  <Input placeholder="Label (e.g. Apply Online)" value={l.label} onChange={(e) => setLinks((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="sm:w-1/3" />
                  <div className="flex-1">
                    <Input placeholder="https://…" value={l.url} onChange={(e) => setLinks((p) => p.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className={invalid ? "border-red-400" : ""} />
                    {invalid && <p className="mt-1 text-xs text-red-600">Link http:// ya https:// se shuru hona chahiye</p>}
                  </div>
                  <button type="button" onClick={() => setLinks((p) => p.filter((_, j) => j !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border text-muted-foreground hover:bg-secondary" title="Remove">✕</button>
                </div>
              );
            })}
          </SectionCard>

          {/* ===== Push & Quality (SEO) ===== */}
          <SectionCard color="border-l-rose-500" icon="📣" title="Push & Quality" subtitle="Push notification, Google preview">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pushNotify} onChange={(e) => setPushNotify(e.target.checked)} className="h-4 w-4" />
              Publish par push notification bhejo (subscribers ko)
            </label>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">Google preview</p>
              <p className="mt-1 truncate text-[13px] text-emerald-700 dark:text-emerald-400">examskitayari.com › {PATH_OF[category]} › {slug || "your-post"}</p>
              <p className="truncate text-[18px] text-[#1a0dab] dark:text-[#8ab4f8]">{metaTitle}</p>
              <p className="line-clamp-2 text-[13px] text-muted-foreground">{metaDesc || "Short summary daalein taaki search me sahi dikhe."}</p>
            </div>
          </SectionCard>

          {/* ===== Thumbnail ===== */}
          <SectionCard color="border-l-fuchsia-500" icon="🖼️" title="Thumbnail" subtitle="Auto-generated social image (title/category se)">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ogSrc} alt="Thumbnail preview" className="w-full max-w-md rounded-lg border" width={1200} height={630} />
            <p className="text-xs text-muted-foreground">Title / category badalne par thumbnail apne aap update ho jaayega.</p>
          </SectionCard>

          {/* ===== Schedule ===== */}
          {canPublish && (
            <SectionCard color="border-l-slate-400" icon="⏰" title="Schedule (optional)" subtitle="Baad me auto-publish">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="sm:w-64" />
                <Button variant="outline" onClick={() => runSave("schedule")} disabled={busy || !scheduledFor}>Schedule Publish</Button>
              </div>
              <p className="text-xs text-muted-foreground">Chune gaye time par site ki cron se apne aap publish ho jayegi.</p>
            </SectionCard>
          )}
        </div>

        {/* ================= ASSISTANT ================= */}
        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Post Health</h3>
              <span className="text-sm font-bold">{completion}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div className={`h-full transition-all ${completion >= 80 ? "bg-emerald-500" : completion >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${completion}%` }} />
            </div>
            {missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Baaki: {missing.join(", ")}</p>}
            <ul className="mt-3 space-y-1.5 text-sm">
              {progress.map((c) => (
                <li key={c.key} className="flex items-center gap-2">
                  <span className={c.done ? "text-emerald-600" : "text-muted-foreground"}>{c.done ? "✓" : "○"}</span>
                  <span className={c.done ? "" : "text-muted-foreground"}>{c.key}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-bold">Quick Actions</h3>
            <div className="space-y-2">
              <button onClick={runGenerate} disabled={genPending} className="w-full rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
                {aiEnabled ? "🤖 AI se poori post likho" : "✨ Content banao"}
              </button>
              <Button variant="outline" size="sm" className="w-full" onClick={() => runSave("draft")} disabled={busy}>💾 Save Draft</Button>
              {canPublish && <Button size="sm" className="w-full" onClick={() => runSave("publish")} disabled={busy}>🚀 Publish Now</Button>}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 text-xs shadow-sm">
            <h3 className="text-sm font-bold text-foreground">AI Status</h3>
            <p className="mt-1 text-muted-foreground">
              {aiEnabled ? "AI ON — PDF/URL se fields aur poori post AI likhega. Har fact official source se verify karein, AI kabhi-kabhi galti karta hai." : "AI OFF — abhi fields rule-based nikal rahe hain. Admin → AI Provider se AI enable karke quality badhayein."}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground shadow-sm">
            <h3 className="text-sm font-bold text-foreground">Shortcuts</h3>
            <p className="mt-1"><kbd className="rounded border px-1">Ctrl</kbd> + <kbd className="rounded border px-1">S</kbd> — Save draft</p>
            {canPublish && <p><kbd className="rounded border px-1">Ctrl</kbd> + <kbd className="rounded border px-1">Enter</kbd> — Publish</p>}
          </div>
        </aside>
      </div>

      {/* ===== Mobile bottom bar ===== */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t bg-card p-3 lg:hidden">
        <Badge variant={completion >= 80 ? "success" : "secondary"}>{completion}%</Badge>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => runSave("draft")} disabled={busy}>Save</Button>
        {canPublish && <Button size="sm" className="flex-1" onClick={() => runSave("publish")} disabled={busy}>Publish</Button>}
      </div>

      <span className="hidden">{cat?.label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field input                                                         */
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
          {(f.options ?? []).map((o) => (<option key={o} value={o}>{o || "— select —"}</option>))}
        </select>
      ) : (
        <Input id={f.name} type={f.type === "date" ? "date" : f.type === "url" ? "url" : "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} className={`mt-1 ${urlInvalid ? "border-red-400" : ""}`} />
      )}
      {f.chips && <Chips items={f.chips} onPick={onChange} />}
      {urlInvalid && <p className="mt-1 text-xs text-red-600">http:// ya https:// se shuru karein</p>}
    </div>
  );
}
