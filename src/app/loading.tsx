import { Spinner } from "@/components/ui";
export default function Loading() {
  return (
    <main tabIndex={-1} id="main">
      <Spinner label="Preparing this page…" />
    </main>
  );
}
