import { ImageResponse } from "next/og";

export const runtime = "edge";

const CATEGORY_LABEL: Record<string, string> = {
  JOB: "Latest Job", ADMIT_CARD: "Admit Card", RESULT: "Result", ANSWER_KEY: "Answer Key",
  EXAM_DATE: "Exam Date", CUTOFF: "Cut Off", MERIT_LIST: "Merit List", NOTICE: "Notice",
  SYLLABUS: "Syllabus", CURRENT_AFFAIRS: "Current Affairs", OTHER: "Update",
};

/**
 * Branded featured / OpenGraph image, generated on the fly.
 * /api/og?title=...&category=JOB[&year=2026]
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "ExamsKiTayari").slice(0, 140);
  const category = searchParams.get("category") || "";
  const label = CATEGORY_LABEL[category] || "Exam Update";
  const year = searchParams.get("year") || String(new Date().getUTCFullYear());

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%", width: "100%", display: "flex", flexDirection: "column",
          background: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 55%, #ea580c 140%)",
          color: "white", padding: "64px", fontFamily: "sans-serif", justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ background: "#ea580c", borderRadius: 12, padding: "8px 16px", fontSize: 30, fontWeight: 800 }}>Ek</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>
              Exams<span style={{ color: "#fb923c" }}>Ki</span>Tayari
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: 999, padding: "10px 24px", fontSize: 26, fontWeight: 700 }}>
            {label} · {year}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: title.length > 80 ? 52 : 64, fontWeight: 800, lineHeight: 1.15 }}>
          {title}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 26, opacity: 0.9 }}>
          <div>Official source · Verified links</div>
          <div>examskitayari.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
