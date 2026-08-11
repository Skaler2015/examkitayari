import { ContentCategory } from "@prisma/client";

type Rule = { category: ContentCategory; patterns: RegExp[]; weight: number };

// Ordered, keyword/rule-based classifier. Higher-specificity categories first.
const RULES: Rule[] = [
  {
    category: ContentCategory.ADMIT_CARD,
    weight: 3,
    patterns: [/admit\s*card/i, /hall\s*ticket/i, /call\s*letter/i, /e-?admit/i, /exam\s*city\s*(slip|intimation)/i],
  },
  {
    category: ContentCategory.ANSWER_KEY,
    weight: 3,
    patterns: [/answer\s*key/i, /response\s*sheet/i, /objection.*(answer|key)/i, /provisional\s*key/i],
  },
  {
    category: ContentCategory.RESULT,
    weight: 3,
    patterns: [/\bresult\b/i, /result\s*(declared|out|released)/i, /scorecard/i, /score\s*card/i],
  },
  {
    category: ContentCategory.CUTOFF,
    weight: 3,
    patterns: [/cut\s*-?\s*off/i, /qualifying\s*marks/i],
  },
  {
    category: ContentCategory.MERIT_LIST,
    weight: 3,
    patterns: [/merit\s*list/i, /selection\s*list/i, /waiting\s*list/i],
  },
  {
    category: ContentCategory.COUNSELLING,
    weight: 2,
    patterns: [/counsell?ing/i, /seat\s*allotment/i, /choice\s*filling/i],
  },
  {
    category: ContentCategory.DOCUMENT_VERIFICATION,
    weight: 2,
    patterns: [/document\s*verification/i, /\bDV\b/i, /physical\s*(test|standard)/i],
  },
  {
    category: ContentCategory.SYLLABUS,
    weight: 2,
    patterns: [/syllabus/i, /exam\s*pattern.*syllabus/i],
  },
  {
    category: ContentCategory.EXAM_PATTERN,
    weight: 2,
    patterns: [/exam\s*pattern/i, /marking\s*scheme/i],
  },
  {
    category: ContentCategory.EXAM_DATE,
    weight: 2,
    patterns: [/exam\s*date/i, /exam\s*schedule/i, /date\s*sheet/i, /time\s*table/i, /postpone/i],
  },
  {
    category: ContentCategory.JOB,
    weight: 2,
    patterns: [
      /recruitment/i,
      /vacanc/i,
      /notification/i,
      /apply\s*online/i,
      /\bbharti\b/i,
      /\bposts?\b.*\d/i,
      /online\s*form/i,
    ],
  },
  {
    category: ContentCategory.NOTICE,
    weight: 1,
    patterns: [/notice/i, /important\s*information/i, /corrigendum/i, /press\s*note/i],
  },
];

export type Classification = {
  category: ContentCategory;
  score: number; // 0..1 confidence
  matched: string[];
};

/** Rule-based classification. AI classification can refine this as a 2nd layer. */
export function classify(text: string): Classification {
  const hay = (text || "").slice(0, 4000);
  let best: { category: ContentCategory; score: number; matched: string[] } = {
    category: ContentCategory.OTHER,
    score: 0,
    matched: [],
  };

  for (const rule of RULES) {
    const matched: string[] = [];
    for (const p of rule.patterns) {
      const m = hay.match(p);
      if (m) matched.push(m[0]);
    }
    if (matched.length === 0) continue;
    // Score = base weight * hit density, normalised to 0..1.
    const raw = rule.weight * matched.length;
    const score = Math.min(1, raw / 6);
    if (score > best.score) best = { category: rule.category, score, matched };
  }

  return best;
}
