import { SharedSnapshot } from "@/components/share";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Approved audience snapshot",
  robots: { index: false, follow: false },
};
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <SharedSnapshot token={(await params).token} />;
}
