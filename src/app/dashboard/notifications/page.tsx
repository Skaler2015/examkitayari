export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { markNotificationsRead } from "@/server/actions/student";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, Button, SectionTitle, EmptyState } from "@/components/ui";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const hasUnread = notifications.some((n) => n.readAt === null);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Notifications"
        action={
          hasUnread ? (
            <form action={markNotificationsRead}>
              <Button type="submit" variant="outline" size="sm">
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Alerts about your followed exams will show up here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const unread = n.readAt === null;
            const inner = (
              <Card className={cn(unread && "border-primary/50 bg-primary/5")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{n.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                </CardContent>
              </Card>
            );
            return n.url ? (
              <Link key={n.id} href={n.url}>
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
