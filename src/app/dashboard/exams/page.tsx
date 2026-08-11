export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { unfollowExam } from "@/server/actions/student";
import { Card, CardContent, Button, SectionTitle, EmptyState, Badge } from "@/components/ui";

export default async function FollowedExamsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const follows = await prisma.examFollow.findMany({
    where: { userId: user.id },
    include: { exam: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Followed exams"
        action={
          <Link href="/exams" className="text-sm font-medium text-primary hover:underline">
            Browse all exams
          </Link>
        }
      />

      {follows.length === 0 ? (
        <EmptyState
          title="You are not following any exams yet"
          description="Follow exams to get their latest jobs, admit cards and results in your feed."
        />
      ) : (
        <div className="space-y-2">
          {follows.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/exams/${f.exam.slug}`} className="font-medium hover:text-primary hover:underline">
                    {f.exam.name}
                  </Link>
                  {f.exam.state && (
                    <div className="mt-1">
                      <Badge variant="secondary">{f.exam.state}</Badge>
                    </div>
                  )}
                </div>
                <form action={unfollowExam.bind(null, f.examId)}>
                  <Button type="submit" variant="outline" size="sm">
                    Unfollow
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
