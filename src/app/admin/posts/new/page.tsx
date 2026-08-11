import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isStaff, can } from "@/lib/auth/rbac";
import { SmartPostWorkspace } from "./SmartPostWorkspace";

// Fetching + PDF/OCR extraction can take a while on slow govt sites.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const user = await getSessionUser();
  if (!isStaff(user)) redirect("/login");

  return <SmartPostWorkspace canPublish={can(user, "articles:publish")} />;
}
