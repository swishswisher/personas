"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, Area, Notice } from "./ui";
export function ContactForm() {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = e.currentTarget;
    const fields = Object.fromEntries(new FormData(f));
    try {
      const r = await fetch("/api/v1/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setMessage(data.message);
      f.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save enquiry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card stack">
      <h2>Tell us what you’re working on.</h2>
      <Field
        label="Your name"
        name="name"
        autoComplete="name"
        required
        maxLength={100}
      />
      <Field
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Field
        label="Company or team"
        name="company"
        autoComplete="organization"
      />
      <Area
        label="How can Personas help?"
        name="text"
        required
        minLength={10}
        maxLength={6000}
      />
      <div hidden>
        <Field label="Leave this empty" name="website" tabIndex={-1} />
      </div>
      <p className="small">
        We’ll use these details to respond to your enquiry.{" "}
        <Link href="/privacy" className="text-link">
          Privacy and data
        </Link>
      </p>
      {error && <Notice tone="red">{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <button className="btn primary" disabled={busy}>
        {busy ? "Saving…" : "Send enquiry"}
      </button>
    </form>
  );
}
