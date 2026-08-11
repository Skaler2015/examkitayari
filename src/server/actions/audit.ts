"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

/** Append an audit-log entry attributed to the current actor. */
export async function writeAudit(
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const user = await getSessionUser();
  const ip = headers().get("x-forwarded-for")?.split(",")[0] ?? undefined;
  await prisma.auditLog.create({
    data: {
      actorId: user?.id ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      meta: meta as object,
      ip,
    },
  });
}
