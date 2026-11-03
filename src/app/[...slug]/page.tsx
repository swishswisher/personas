import { notFound } from "next/navigation";
import { PublicPage, publicPaths } from "@/components/public-page";
import { AuthScreen } from "@/components/auth-screen";
import { db } from "@/server/db";
import { Suspense } from "react";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const path = (await params).slug.join("/");
  if (
    ["login", "signup", "reset", "verify", "invite", "onboarding"].includes(
      path,
    )
  )
    return (
      <Suspense>
        <AuthScreen
          mode={
            path as
              "login" | "signup" | "reset" | "verify" | "invite" | "onboarding"
          }
        />
      </Suspense>
    );
  const content = process.env.DATABASE_URL
    ? await db.contentRevision
        .findFirst({
          where: { slug: path, published: true },
          orderBy: { createdAt: "desc" },
          select: { title: true, body: true },
        })
        .catch(() => null)
    : null;
  if (!publicPaths.includes(path) && !content) notFound();
  return <PublicPage path={path} content={content} />;
}
