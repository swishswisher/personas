import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!session.user.emailVerified) redirect("/verify");
  return <Workspace section={(await params).path?.join("/") || ""} />;
}
