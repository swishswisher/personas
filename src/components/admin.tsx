"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api, type Serialized } from "@/lib/client-api";
import type { adminData } from "@/server/admin";
import { Form } from "./workspace-shared";
import {
  Logo,
  Icon,
  ButtonLink,
  Pill,
  Notice,
  Field,
  Area,
  PageTitle,
  Spinner,
} from "./ui";
type Data = Serialized<Awaited<ReturnType<typeof adminData>>>;
export function Admin({ section }: { section: string }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [q, setQ] = useState("");
  async function refresh() {
    setData(await api<Data>("admin"));
  }
  useEffect(() => {
    let active = true;
    api<Data>("admin")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(c: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await api("admin", c);
      await refresh();
      setMessage("Operation saved and audited.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main tabIndex={-1} id="main" className="not-found stack">
        <Logo />
        {error ? <Notice tone="red">{error}</Notice> : <Spinner />}
      </main>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <Pill>Platform operations · {data.role}</Pill>
        <nav className="sidenav" aria-label="Platform administration">
          {[
            ["", "Overview", "grid"],
            ["workspaces", "Workspaces", "folder"],
            ["subscriptions", "Subscriptions", "card"],
            ["support", "Support queue", "help"],
            ["content", "Content & enquiries", "book"],
            ["audit", "Audit & job queue", "shield"],
          ].map(([path, label, icon]) => (
            <Link
              href={"/admin" + (path ? "/" + path : "")}
              className={section === path ? "active" : ""}
              key={path}
            >
              <Icon
                name={
                  icon as
                    "grid" | "folder" | "card" | "help" | "book" | "shield"
                }
              />
              {label}
            </Link>
          ))}
        </nav>
        <ButtonLink href="/app" tone="">
          Customer workspace
        </ButtonLink>
      </aside>
      <div className="app-main">
        <header className="appbar">
          <span>Personas / platform administration</span>
          <Link href="/app" className="text-link">
            Workspace <Icon name="arrow" />
          </Link>
        </header>
        <main tabIndex={-1} id="main" className="app-content">
          <div className="content-limit">
            <nav className="admin-mobile-nav row">
              {[
                "",
                "workspaces",
                "subscriptions",
                "support",
                "content",
                "audit",
              ].map((s) => (
                <Link key={s} className="btn" href={"/admin/" + s}>
                  {s || "Overview"}
                </Link>
              ))}
            </nav>
            <PageTitle
              eyebrow="Service operations"
              title={
                (
                  {
                    "": "A thoughtful service, well run.",
                    workspaces: "Workspace operations.",
                    subscriptions: "Subscriptions & event processing.",
                    support: "Keep the conversation moving.",
                    content: "A clear public story.",
                    audit: "An accountable record.",
                  } as Record<string, string>
                )[section] || "Platform operations"
              }
              description="Staff access is separate from customer permissions. Raw research is not included in account administration."
            />
            {error && <Notice tone="red">{error}</Notice>}
            {message && <Notice>{message}</Notice>}
            {!section ? (
              <>
                <div className="grid g4 mb24">
                  {[
                    ["Workspaces", data.workspaces.length],
                    [
                      "Open support",
                      data.support.filter((s) => s.status !== "resolved")
                        .length,
                    ],
                    [
                      "New enquiries",
                      data.enquiries.filter((e) => e.status === "new").length,
                    ],
                    [
                      "Jobs needing attention",
                      data.jobs.filter(
                        (j) => j.status === "dead" || j.status === "retry",
                      ).length,
                    ],
                  ].map(([label, n]) => (
                    <div className="card metric" key={label}>
                      <span className="mini-count">{n}</span>
                      <p>{label}</p>
                    </div>
                  ))}
                </div>
                <div className="card dark stack">
                  <h2 className="serif">Trust is an operational habit.</h2>
                  <p>
                    Check failed delivery jobs, review access changes, and keep
                    public content accurate. Customer research stays within its
                    permission boundaries.
                  </p>
                  <ButtonLink href="/admin/audit" tone="apricot">
                    Review the job queue
                  </ButtonLink>
                </div>
              </>
            ) : section === "workspaces" ? (
              <div className="stack">
                <Field
                  label="Search workspace names"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Workspace</th>
                        <th>Members</th>
                        <th>Projects</th>
                        <th>Plan</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.workspaces
                        .filter((w) =>
                          w.name.toLowerCase().includes(q.toLowerCase()),
                        )
                        .map((w) => (
                          <tr key={w.id}>
                            <td>
                              <strong>{w.name}</strong>
                              <small>
                                {w.id}
                                {w.demo ? " · fictional demonstration" : ""}
                              </small>
                            </td>
                            <td>{w._count.memberships}</td>
                            <td>{w._count.projects}</td>
                            <td>{w.subscription?.plan || "free"}</td>
                            <td>
                              {new Date(w.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Notice>
                  Account context does not grant access to research. Use
                  customer-authorized project membership for any research
                  assistance.
                </Notice>
              </div>
            ) : section === "subscriptions" ? (
              <div className="stack">
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Workspace</th>
                        <th>Plan</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.workspaces.map((w) => (
                        <tr key={w.id}>
                          <td>{w.name}</td>
                          <td>{w.subscription?.plan || "free"}</td>
                          <td>{w.subscription?.status || "free"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h2>Provider events</h2>
                {data.billing.length ? (
                  data.billing.map((b) => (
                    <div className="card row between" key={b.id}>
                      <div>
                        <strong>{b.type}</strong>
                        <p className="small">
                          {b.id} · {b.error || "No processing error"}
                        </p>
                      </div>
                      <Pill tone={b.status === "failed" ? "red" : "brand"}>
                        {b.status}
                      </Pill>
                    </div>
                  ))
                ) : (
                  <p>No billing events have been received.</p>
                )}
                <ButtonLink href="/admin/audit" tone="">
                  Inspect retry jobs
                </ButtonLink>
              </div>
            ) : section === "support" ? (
              <div className="stack">
                {data.support.length ? (
                  data.support.map((s) => (
                    <div className="card stack" key={s.id}>
                      <div className="row between">
                        <h2>{s.subject}</h2>
                        <Pill>{s.status}</Pill>
                      </div>
                      <p className="small">
                        {s.email} · workspace {s.workspaceId}
                      </p>
                      <p className="preserve-lines">{s.text}</p>
                      <Form
                        busy={busy}
                        onSubmit={async (f) =>
                          run({
                            action: "support.reply",
                            id: s.id,
                            text: f.get("text"),
                            status: f.get("status"),
                            reason: f.get("reason"),
                          })
                        }
                      >
                        <Area
                          label="Reply to customer"
                          name="text"
                          required
                          maxLength={6000}
                        />
                        <div className="field">
                          <label htmlFor={"status-" + s.id}>
                            Request status
                          </label>
                          <select
                            id={"status-" + s.id}
                            name="status"
                            defaultValue={s.status}
                          >
                            <option>open</option>
                            <option>pending</option>
                            <option>resolved</option>
                          </select>
                        </div>
                        <Field
                          label="Recorded reason for this staff action"
                          name="reason"
                          required
                          minLength={10}
                          maxLength={500}
                        />
                        <button className="btn primary">
                          Save reply & queue email
                        </button>
                      </Form>
                    </div>
                  ))
                ) : (
                  <p>No support requests yet.</p>
                )}
              </div>
            ) : section === "content" ? (
              <div className="split">
                <div className="card stack">
                  <h2>Publish a content revision.</h2>
                  <Form
                    busy={busy || data.role !== "admin"}
                    onSubmit={async (f) =>
                      run({
                        action: "content.save",
                        slug: f.get("slug"),
                        title: f.get("title"),
                        body: f.get("body"),
                        published: f.has("published"),
                        reason: f.get("reason"),
                      })
                    }
                  >
                    <Field
                      label="Page path"
                      name="slug"
                      required
                      pattern="[a-z0-9/-]+"
                      placeholder="resources/evidence"
                    />
                    <Field
                      label="Page title"
                      name="title"
                      required
                      maxLength={150}
                    />
                    <Area
                      label="Article body (plain text, paragraphs separated by blank lines)"
                      name="body"
                      required
                      minLength={10}
                      maxLength={30000}
                      rows={12}
                    />
                    <label className="check">
                      <input type="checkbox" name="published" />
                      Publish this revision
                    </label>
                    <Field
                      label="Reason for this revision"
                      name="reason"
                      required
                      minLength={10}
                    />
                    <button className="btn primary">
                      Save content revision
                    </button>
                  </Form>
                  <h3>Recent revisions</h3>
                  {data.content.map((r) => (
                    <div className="listitem" key={r.id}>
                      <div>
                        <strong>{r.title}</strong>
                        <p>
                          {r.slug} · {r.published ? "Published" : "Draft"}
                        </p>
                        {r.published && data.role === "admin" && (
                          <button
                            className="text-link danger-text"
                            disabled={busy}
                            onClick={() => {
                              const reason = prompt(
                                "Record a reason for unpublishing this page (at least 10 characters).",
                              );
                              if (reason && reason.trim().length >= 10)
                                void run({
                                  action: "content.unpublish",
                                  slug: r.slug,
                                  reason,
                                });
                            }}
                          >
                            Unpublish page
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="stack">
                  <h2>Enquiry inbox</h2>
                  {data.enquiries.length ? (
                    data.enquiries.map((e) => (
                      <div className="card stack" key={e.id}>
                        <Pill>{e.status}</Pill>
                        <h3>{e.name}</h3>
                        <p>
                          {e.email} · {e.company || "Independent"}
                        </p>
                        <p className="preserve-lines">{e.text}</p>
                        <Form
                          busy={busy}
                          onSubmit={async (f) =>
                            run({
                              action: "enquiry.status",
                              id: e.id,
                              status: f.get("status"),
                              reason: f.get("reason"),
                            })
                          }
                        >
                          <select
                            aria-label="Enquiry status"
                            name="status"
                            defaultValue={e.status}
                          >
                            <option>new</option>
                            <option>in_progress</option>
                            <option>closed</option>
                          </select>
                          <Field
                            label="Action reason"
                            name="reason"
                            required
                            minLength={10}
                          />
                          <button className="btn">Update enquiry</button>
                        </Form>
                      </div>
                    ))
                  ) : (
                    <p>No enquiries yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="stack">
                <h2>Background queue</h2>
                {data.jobs.map((j) => (
                  <div className="card stack sm" key={j.id}>
                    <div className="row between">
                      <h3>{j.kind}</h3>
                      <Pill tone={j.status === "dead" ? "red" : "amber"}>
                        {j.status} · {j.attempts} attempts
                      </Pill>
                    </div>
                    <p>{j.error || "Waiting for processing."}</p>
                    <Form
                      busy={busy || data.role !== "admin"}
                      onSubmit={async (f) =>
                        run({
                          action: "job.retry",
                          id: j.id,
                          reason: f.get("reason"),
                        })
                      }
                    >
                      <Field
                        label="Retry reason"
                        name="reason"
                        required
                        minLength={10}
                      />
                      <button className="btn">Retry job</button>
                    </Form>
                  </div>
                ))}
                <h2>Audit history</h2>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Target</th>
                        <th>When</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.audit.map((a) => (
                        <tr key={a.id}>
                          <td>{a.action}</td>
                          <td>{a.actorId}</td>
                          <td>{a.targetId}</td>
                          <td>{new Date(a.createdAt).toLocaleString()}</td>
                          <td>{JSON.stringify(a.detail)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
