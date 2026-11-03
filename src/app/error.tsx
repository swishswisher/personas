"use client";
import Link from "next/link";
import { Notice, Logo } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main tabIndex={-1} id="main" className="not-found stack">
      <Logo />
      <h1 className="serif">Let’s try that again.</h1>
      <Notice tone="red">
        This page could not load. Your previously saved work is safe.
      </Notice>
      <button className="btn primary" onClick={reset}>
        Try again
      </button>
      <Link className="text-link" href="/app/support">
        Contact support
      </Link>
    </main>
  );
}
