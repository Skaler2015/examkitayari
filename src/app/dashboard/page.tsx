export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { categoryPath, timeAgo } from "@/lib/format";
import { Card, CardContent, Badge, SectionTitle, EmptyState } from "@/components/ui";
import { PublishStatus } from "@prisma/client";

function StatTile({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="p-4 sm:p-5">
          <p className="text-2xl font-bold sm:text-3xl">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardOverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [followedCount, bookmarksCount, testsTaken, unreadCount, follows] = await Promise.all([
    prisma.examFollow.count({ where: { userId: user.id } }),
    prisma.bookmark.count({ where: { userId: user.id } }),
    prisma.userAttempt.count({ where: { userId: user.id, mockTestId: { not: null } } }),
    prisma.notification.count({
      where: { userId: user.id, readAt: null, status: { in: ["SENT", "QUEUED"] } },
    }),
    prisma.examFollow.findMany({ where: { userId: user.id }, select: { examId: true } }),
  ]);

  const examIds = follows.map((f) => f.examId);

  const articles = examIds.length
    ? await prisma.article.findMany({
        where: {
          status: PublishStatus.PUBLISHED,
          OR: [
            { job: { examId: { in: examIds } } },
            { admitCard: { examId: { in: examIds } } },
            { result: { examId: { in: examIds } } },
            { answerKey: { examId: { in: examIds } } },
          ],
        },
        orderBy: { publishedAt: "desc" },
        take: 8,
      })
    : await prisma.article.findMany({
        where: { status: PublishStatus.PUBLISHED },
        orderBy: { publishedAt: "desc" },
        take: 8,
      });

  const displayName = user.name || user.email.split("@")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hi {displayName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here is what is happening across your exams.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Followed exams" value={followedCount} href="/dashboard/exams" />
        <StatTile label="Bookmarks" value={bookmarksCount} href="/dashboard/bookmarks" />
        <StatTile label="Tests taken" value={testsTaken} href="/dashboard/history" />
        <StatTile label="Unread alerts" value={unreadCount} href="/dashboard/notifications" />
      </div>

      <div>
        <SectionTitle
          title={examIds.length ? "Latest updates for you" : "Latest updates"}
          action={
            <Link href="/exams" className="text-sm font-medium text-primary hover:underline">
              Browse exams
            </Link>
          }
        />
        {articles.length === 0 ? (
          <EmptyState
            title="No updates yet"
            description="Follow a few exams to get personalised updates here."
          />
        ) : (
          <div className="space-y-2">
            {articles.map((a) => (
              <Link key={a.id} href={categoryPath(a.category, a.slug)}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(a.publishedAt)}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {a.category.replace(/_/g, " ")}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
