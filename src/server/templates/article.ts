import { ContentCategory } from "@prisma/client";

/**
 * Rich, sectioned article-body builders for the common sarkari-exam content
 * types. Produces clean HTML (headings + tables) from verified/structured data.
 * Missing values render "Not Available in Official Source" — never guessed.
 *
 * Used by both the deterministic (no-AI) template path and the structured
 * manual-post form, so posts look detailed and consistent either way.
 */

const NA = "Not Available in Official Source";

function fmt(v: unknown): string {
  if (v == null || v === "") return NA;
  if (v instanceof Date) return isNaN(v.getTime()) ? NA : v.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  }
  return esc(String(v));
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
}

function table(rows: [string, unknown][]): string {
  const body = rows
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td>${fmt(v)}</td></tr>`)
    .join("");
  if (!body) return "";
  return `<table><tbody>${body}</tbody></table>`;
}

function linksTable(links: { label: string; url?: unknown }[]): string {
  const rows = links
    .filter((l) => typeof l.url === "string" && /^https?:\/\//.test(l.url as string))
    .map((l) => `<tr><td><strong>${esc(l.label)}</strong></td><td><a href="${esc(l.url as string)}" rel="nofollow noopener noreferrer" target="_blank">Click Here</a></td></tr>`)
    .join("");
  if (!rows) return "";
  return `<h2>Important Links</h2><table><tbody>${rows}</tbody></table>`;
}

export type ArticleContent = { body: string; importantPoints: string[]; faq: { q: string; a: string }[] };

type AnyData = Record<string, unknown>;

function get(d: AnyData, ...keys: string[]): unknown {
  for (const k of keys) if (d[k] != null && d[k] !== "") return d[k];
  return undefined;
}

// --- JOB ----------------------------------------------------------------

function jobContent(title: string, d: AnyData, officialUrl?: string): ArticleContent {
  const org = get(d, "organization");
  const post = get(d, "postName", "recruitmentName");
  const vacancy = get(d, "vacancyCount", "vacancy");
  const start = get(d, "applicationStart");
  const end = get(d, "applicationEnd");
  const examDate = get(d, "examDate");
  const importantDates = Array.isArray(d.importantDates) ? (d.importantDates as { label: string; date: string }[]) : [];

  const datesRows: [string, unknown][] = importantDates.length
    ? importantDates.map((x) => [x.label, x.date] as [string, unknown])
    : ([
        ["Application Start Date", start],
        ["Last Date to Apply", end],
        ["Last Date to Pay Fee", get(d, "feeLastDate")],
        ["Correction Window", get(d, "correctionDate")],
        ["Exam Date", examDate],
        ["Admit Card", get(d, "admitCardDate")],
      ] as [string, unknown][]);

  const sections: string[] = [];
  sections.push(
    `<p>${esc(String(org ?? "The recruiting organisation"))} has released the official notification for <strong>${esc(title)}</strong>. ${
      vacancy ? `A total of <strong>${fmt(vacancy)}</strong> vacancies are on offer. ` : ""
    }Candidates can find the complete details — important dates, eligibility, application fee, vacancy break-up and how to apply — below. Always verify the final details on the official notification.</p>`
  );

  const dt = table(datesRows);
  if (dt) sections.push(`<h2>Important Dates</h2>${dt}`);

  const fee = table([
    ["Application Fee", get(d, "applicationFee")],
    ["Payment Mode", get(d, "paymentMode")],
  ]);
  if (fee) sections.push(`<h2>Application Fee</h2>${fee}`);

  const vac = table([
    ["Total Vacancies", vacancy],
    ["Post Name", post],
    ["Vacancy Details", get(d, "vacancyDetail")],
  ]);
  if (vac) sections.push(`<h2>Vacancy Details</h2>${vac}`);

  const elig = table([
    ["Educational Qualification", get(d, "qualification")],
    ["Experience", get(d, "experience")],
  ]);
  if (elig) sections.push(`<h2>Eligibility</h2>${elig}`);

  const age = table([
    ["Age Limit", get(d, "ageLimit")],
    ["Age Relaxation", get(d, "ageRelaxation")],
  ]);
  if (age) sections.push(`<h2>Age Limit</h2>${age}`);

  const salary = get(d, "salary");
  if (salary) sections.push(`<h2>Salary / Pay Scale</h2><p>${fmt(salary)}</p>`);

  const selection = get(d, "selectionProcess");
  if (selection) sections.push(`<h2>Selection Process</h2><p>${fmt(selection)}</p>`);

  const applyUrl = get(d, "applyOnlineUrl");
  sections.push(
    `<h2>How to Apply</h2><ul>` +
      `<li>Visit the official website of ${esc(String(org ?? "the organisation"))}.</li>` +
      `<li>Read the official notification carefully before applying.</li>` +
      `<li>Register and fill the online application form with correct details.</li>` +
      `<li>Upload the required documents, photo and signature.</li>` +
      `<li>Pay the application fee (if applicable) and submit the form.</li>` +
      `<li>Take a printout of the submitted form for future reference.</li>` +
      `</ul>`
  );

  const instructions = get(d, "importantInstructions");
  if (instructions) sections.push(`<h2>Important Instructions</h2><p>${fmt(instructions)}</p>`);

  sections.push(
    linksTable([
      { label: "Apply Online", url: applyUrl },
      { label: "Download Notification (PDF)", url: get(d, "officialNotificationUrl") ?? officialUrl },
      { label: "Official Website", url: get(d, "officialWebsite") },
    ])
  );

  sections.push(
    `<p><em>Information status: compiled from the official source and pending final human verification. Fields marked "${NA}" were not found and are not guessed.</em></p>`
  );

  const importantPoints = [
    org ? `Organisation: ${fmt(org)}` : "",
    vacancy ? `Total Vacancies: ${fmt(vacancy)}` : "",
    end ? `Last Date to Apply: ${fmt(end)}` : "",
    examDate ? `Exam Date: ${fmt(examDate)}` : "",
    get(d, "qualification") ? `Qualification: ${fmt(get(d, "qualification"))}` : "",
  ].filter(Boolean) as string[];

  const faq = [
    { q: `What is the last date to apply for ${title}?`, a: end ? `The last date to apply is ${fmt(end)}. Confirm on the official notification.` : `Please check the official notification for the last date to apply.` },
    { q: `How many vacancies are there in ${title}?`, a: vacancy ? `There are ${fmt(vacancy)} vacancies as per the notification.` : `Check the official notification for the total number of vacancies.` },
    { q: `How can I apply for ${title}?`, a: `Apply online through the official website using the "Apply Online" link once the application window is open. Read the full notification first.` },
    { q: `Is the information on this page official?`, a: `This page compiles details from the official source and links back to it. Always verify final details on the official website.` },
  ];

  return { body: sections.filter(Boolean).join("\n"), importantPoints, faq };
}

// --- ADMIT CARD / RESULT / ANSWER KEY -----------------------------------

function simpleContent(kind: "admit" | "result" | "answer", title: string, d: AnyData, officialUrl?: string): ArticleContent {
  const exam = get(d, "examName");
  const label = kind === "admit" ? "Admit Card" : kind === "result" ? "Result" : "Answer Key";
  const dateLabel = kind === "admit" ? "Release Date" : kind === "result" ? "Result Date" : "Release Date";
  const dateVal = get(d, "releaseDate", "examDate");
  const linkVal = get(d, "downloadUrl", "resultUrl", "answerKeyUrl", "scorecardUrl");

  const sections: string[] = [];
  sections.push(
    `<p>The ${esc(label)} for <strong>${esc(title)}</strong> ${dateVal ? `is available (${fmt(dateVal)})` : "status is given below"}. Candidates can check the details and the official link below.</p>`
  );

  const info = table([
    ["Exam Name", exam],
    [dateLabel, dateVal],
    ["Exam Date", get(d, "examDate")],
    ["Type", get(d, "resultType", "keyType", "examShift")],
    ["Objection Window (Start)", get(d, "objectionStart")],
    ["Objection Window (End)", get(d, "objectionEnd")],
  ]);
  if (info) sections.push(`<h2>${esc(label)} Details</h2>${info}`);

  const steps =
    kind === "admit"
      ? ["Visit the official website.", "Click on the admit card / hall ticket link.", "Enter your registration number and date of birth / password.", "Download and print the admit card."]
      : kind === "result"
        ? ["Visit the official website.", "Click on the result link.", "Enter your roll number / registration details.", "View and download your result / scorecard."]
        : ["Visit the official website.", "Click on the answer key link.", "Login with your credentials if required.", "Download the answer key and response sheet."];
  sections.push(`<h2>How to ${kind === "result" ? "Check Result" : "Download"}</h2><ul>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`);

  if (kind === "answer") {
    sections.push(
      `<h2>Objection / Challenge Process</h2><p>If you disagree with any answer, you can raise an objection during the objection window (${fmt(get(d, "objectionStart"))} to ${fmt(get(d, "objectionEnd"))}) through the official portal, along with any required fee and supporting proof.</p>`
    );
  }

  sections.push(
    linksTable([
      { label: `Download ${label}`, url: linkVal ?? officialUrl },
      { label: "Response Sheet", url: get(d, "responseSheetUrl") },
      { label: "Official Website", url: get(d, "officialWebsite") },
    ])
  );

  sections.push(`<p><em>Information status: compiled from the official source. Verify final details on the official website.</em></p>`);

  const importantPoints = [exam ? `Exam: ${fmt(exam)}` : "", dateVal ? `${dateLabel}: ${fmt(dateVal)}` : ""].filter(Boolean) as string[];
  const faq = [
    { q: `How do I get the ${label.toLowerCase()} for ${title}?`, a: `Use the official link above and enter your details.` },
    { q: `Is this the official ${label.toLowerCase()}?`, a: `This page links to the official source — always download from the official website.` },
  ];
  return { body: sections.filter(Boolean).join("\n"), importantPoints, faq };
}

// --- dispatch -----------------------------------------------------------

export function buildArticleContent(category: ContentCategory, title: string, data: AnyData, officialUrl?: string): ArticleContent {
  switch (category) {
    case ContentCategory.JOB:
      return jobContent(title, data, officialUrl);
    case ContentCategory.ADMIT_CARD:
      return simpleContent("admit", title, data, officialUrl);
    case ContentCategory.RESULT:
      return simpleContent("result", title, data, officialUrl);
    case ContentCategory.ANSWER_KEY:
      return simpleContent("answer", title, data, officialUrl);
    default: {
      const rows = Object.entries(data).filter(([, v]) => v != null && v !== "");
      const body =
        `<p>${esc(title)}. Details compiled from the official source are below.</p>` +
        (rows.length ? table(rows as [string, unknown][]) : "") +
        (officialUrl ? `<h2>Official Source</h2><p><a href="${esc(officialUrl)}" rel="nofollow noopener noreferrer" target="_blank">View official source</a></p>` : "");
      return {
        body,
        importantPoints: rows.slice(0, 5).map(([k, v]) => `${k}: ${fmt(v)}`),
        faq: [{ q: `Where can I find official details for "${title}"?`, a: officialUrl ? `Visit: ${officialUrl}` : "Check the official website of the organisation." }],
      };
    }
  }
}
