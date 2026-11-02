import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { staffAccess } from "@/server/security";
import { Admin } from "@/components/admin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Platform administration",
  robots: { index: false, follow: false },
};
export default async function AdminPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) redirect("/login");
  try {
    await staffAccess(session.user);
  } catch {
    redirect("/app?error=staff_access");
  }
  return <Admin section={(await params).path?.join("/") || ""} />;
}
