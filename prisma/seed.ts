/**
 * Database seed. Creates the bootstrap admin, master data (categories, states),
 * safe automation defaults, and a few EXAMPLE official sources.
 *
 * NOTE: Sources are DATA, not code. They live in the database and are fully
 * editable from ADMIN → SOURCES. The examples below are starting points using
 * public official portals; edit/remove them freely in the admin panel.
 */
import { PrismaClient, ContentCategory, SourceType, Priority, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { slugify } from "../src/lib/utils";

const prisma = new PrismaClient();

const CATEGORIES: { key: ContentCategory; label: string }[] = [
  { key: "JOB", label: "Latest Jobs" },
  { key: "ADMIT_CARD", label: "Admit Card" },
  { key: "RESULT", label: "Result" },
  { key: "ANSWER_KEY", label: "Answer Key" },
  { key: "EXAM_DATE", label: "Exam Date" },
  { key: "CUTOFF", label: "Cut Off" },
  { key: "MERIT_LIST", label: "Merit List" },
  { key: "NOTICE", label: "Notice" },
  { key: "SYLLABUS", label: "Syllabus" },
  { key: "EXAM_PATTERN", label: "Exam Pattern" },
  { key: "COUNSELLING", label: "Counselling" },
  { key: "DOCUMENT_VERIFICATION", label: "Document Verification" },
  { key: "OTHER", label: "Other" },
];

const STATES = [
  "All India", "Rajasthan", "Uttar Pradesh", "Bihar", "Madhya Pradesh", "Delhi", "Haryana",
  "Punjab", "Maharashtra", "Gujarat", "West Bengal", "Karnataka", "Tamil Nadu", "Telangana",
  "Andhra Pradesh", "Kerala", "Odisha", "Jharkhand", "Chhattisgarh", "Uttarakhand", "Assam",
];

// Example official sources — starting points, editable in admin.
const EXAMPLE_SOURCES: {
  name: string;
  org: string;
  monitorUrl: string;
  website: string;
  type: SourceType;
  priority: Priority;
  frequency: number;
  categories: ContentCategory[];
  keywords: string[];
}[] = [
  {
    name: "SSC — What's New",
    org: "Staff Selection Commission",
    monitorUrl: "https://ssc.gov.in/",
    website: "https://ssc.gov.in/",
    type: SourceType.HTML_PAGE,
    priority: Priority.HIGH,
    frequency: 30,
    categories: ["JOB", "ADMIT_CARD", "RESULT", "ANSWER_KEY"],
    keywords: ["notice", "admit", "result", "answer key", "recruitment"],
  },
  {
    name: "UPSC — What's New",
    org: "Union Public Service Commission",
    monitorUrl: "https://www.upsc.gov.in/whats-new",
    website: "https://www.upsc.gov.in/",
    type: SourceType.HTML_PAGE,
    priority: Priority.HIGH,
    frequency: 60,
    categories: ["JOB", "ADMIT_CARD", "RESULT", "NOTICE"],
    keywords: ["notification", "admit", "result", "exam"],
  },
  {
    name: "RSMSSB — News",
    org: "Rajasthan Staff Selection Board",
    monitorUrl: "https://rsmssb.rajasthan.gov.in/",
    website: "https://rsmssb.rajasthan.gov.in/",
    type: SourceType.HTML_PAGE,
    priority: Priority.HIGH,
    frequency: 30,
    categories: ["JOB", "ADMIT_CARD", "RESULT", "ANSWER_KEY"],
    keywords: ["bharti", "admit", "result", "answer key"],
  },
];

async function main() {
  console.log("Seeding database…");

  // Categories
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { key: c.key },
      create: { key: c.key, label: c.label, slug: slugify(c.label) },
      update: { label: c.label },
    });
  }

  // States
  for (const name of STATES) {
    await prisma.state.upsert({
      where: { name },
      create: { name, slug: slugify(name) },
      update: {},
    });
  }

  // Global automation settings (safe defaults: manual review on).
  await prisma.automationSetting.upsert({
    where: { scope: "GLOBAL" },
    create: { scope: "GLOBAL", autoPublish: false },
    update: {},
  });
  // Per-category manual-review defaults.
  for (const cat of ["JOB", "ADMIT_CARD", "RESULT", "ANSWER_KEY", "NOTICE"] as ContentCategory[]) {
    await prisma.automationSetting.upsert({
      where: { scope: cat },
      create: { scope: cat, autoPublish: false },
      update: {},
    });
  }

  // Bootstrap admin
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@examskitayari.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe#12345";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: process.env.SEED_ADMIN_NAME ?? "Platform Admin",
      passwordHash,
      role: UserRole.ADMIN,
      emailVerified: new Date(),
    },
    update: { role: UserRole.ADMIN },
  });
  console.log(`  Admin: ${adminEmail}`);

  // Example organizations + sources
  for (const s of EXAMPLE_SOURCES) {
    const org = await prisma.organization.upsert({
      where: { slug: slugify(s.org) },
      create: { name: s.org, slug: slugify(s.org), website: s.website },
      update: {},
    });
    const existing = await prisma.source.findFirst({ where: { monitorUrl: s.monitorUrl } });
    if (!existing) {
      await prisma.source.create({
        data: {
          name: s.name,
          organizationId: org.id,
          websiteUrl: s.website,
          monitorUrl: s.monitorUrl,
          type: s.type,
          priority: s.priority,
          frequencyMinutes: s.frequency,
          monitorCategories: s.categories,
          keywords: s.keywords,
          nextCrawlAt: new Date(),
        },
      });
    }
  }
  console.log(`  Example sources: ${EXAMPLE_SOURCES.length}`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
