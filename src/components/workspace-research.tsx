"use client";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { api } from "@/lib/client-api";
import { canEdit } from "@/lib/domain";
import type { WorkspaceContext } from "./workspace";
import { Form, PageControls } from "./workspace-shared";
import {
  Icon,
  ButtonLink,
  Pill,
  Notice,
  Field,
  Area,
  PageTitle,
  Empty,
  Spinner,
} from "./ui";
type Source = {
  id: string;
  title: string;
  text: string;
  kind: string;
  participant: string | null;
  classification: "finding" | "hypothesis" | "fictional";
  status: string;
  failure: string | null;
  fileName: string | null;
  createdAt: string;
};
export function ResearchView({
  ctx: c,
  section,
}: {
  ctx: WorkspaceContext;
  section: string;
}) {
  const id = section.split("/")[1],
    isNew = id === "new";
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || ""),
    [kind, setKind] = useState(params.get("kind") || "all");
  if (isNew) return <NewSource ctx={c} />;
  if (id) return <SourceDetail key={id} ctx={c} id={id} />;
  const list = c.data.sources;
  return (
    <>
      <PageTitle
        title="Keep the context close."
        description="Your sources, observations, and the people behind the patterns."
      >
        {canEdit(c.data.role) && (
          <ButtonLink href={c.href("research/new")} icon="plus">
            Add research
          </ButtonLink>
        )}
      </PageTitle>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          c.go("research", {
            q: query,
            kind: kind === "all" ? "" : kind,
            page: "1",
          });
        }}
      >
        <div className="search">
          <Icon name="search" />
          <input
            aria-label="Search research sources"
            placeholder="Search titles and tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter research type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">Every source type</option>
          {["interview", "survey", "note", "upload"].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <button className="btn" type="submit">
          Search research
        </button>
        <Pill tone="">{c.data.pagination.sourceMatches} matching sources</Pill>
      </form>
      {list.length ? (
        <div className="stack">
          {list.map((s) => (
            <a
              href={c.href("research/" + s.id)}
              key={s.id}
              className="card row between click"
            >
              <div className="row grow">
                <div className="iconbox">
                  <Icon name="file" />
                </div>
                <div className="grow">
                  <h3>{s.title}</h3>
                  <p className="small">
                    {s.kind} · {s.participant || "Participant not specified"} ·{" "}
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                  <div className="row mt16">
                    {s.tags.map((t) => (
                      <span className="tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="stack sm">
                <Pill>{s.classification}</Pill>
                <Pill
                  tone={
                    s.status === "failed"
                      ? "red"
                      : s.status === "processing"
                        ? "amber"
                        : ""
                  }
                >
                  {s.status}
                </Pill>
              </div>
              <Icon name="arrow" />
            </a>
          ))}
        </div>
      ) : (
        <Empty
          title={
            query ? "No matching research." : "Every insight starts somewhere."
          }
          text="Upload a source, record an interview, or capture a survey. Then turn a meaningful passage into an observation."
          icon="file"
        >
          <ButtonLink href={c.href("research/new")}>Add a source</ButtonLink>
        </Empty>
      )}
      <PageControls
        page={c.data.pagination.page}
        total={c.data.pagination.sourceMatches}
        onPage={(page) =>
          c.go("research", {
            q: query,
            kind: kind === "all" ? "" : kind,
            page: String(page),
          })
        }
      />
    </>
  );
}
function NewSource({ ctx: c }: { ctx: WorkspaceContext }) {
  const [mode, setMode] = useState<"record" | "upload">("record"),
    [uploading, setUploading] = useState(false);
  return (
    <>
      <PageTitle
        title="Bring your research in."
        description="Keep the original context, then capture what matters."
      >
        <ButtonLink href={c.href("research")} tone="">
          Back to research
        </ButtonLink>
      </PageTitle>
      <div className="tabs mb24">
        <button
          className={mode === "record" ? "active" : ""}
          onClick={() => setMode("record")}
        >
          Interview, survey, or note
        </button>
        <button
          className={mode === "upload" ? "active" : ""}
          onClick={() => setMode("upload")}
        >
          Upload a source
        </button>
      </div>
      <div className="split">
        <div className="card stack">
          {mode === "record" ? (
            <Form
              busy={c.busy || !canEdit(c.data.role)}
              onSubmit={async (f) => {
                await c.run<{ id: string }>(
                  {
                    action: "source.create",
                    projectId: c.projectId,
                    title: String(f.get("title")),
                    kind: f.get("kind") as "interview" | "survey" | "note",
                    text: String(f.get("text")),
                    participant: String(f.get("participant") || ""),
                    tags: String(f.get("tags") || "")
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                    classification: f.get(
                      "classification",
                    ) as Source["classification"],
                  },
                  (r) => c.go("research/" + r.id),
                );
              }}
            >
              <h2 className="serif">Preserve the original words.</h2>
              <Field
                label="Source title"
                name="title"
                required
                maxLength={200}
              />
              <div className="grid g2">
                <div className="field">
                  <label htmlFor="kind">Record type</label>
                  <select name="kind" id="kind">
                    <option value="interview">Interview</option>
                    <option value="survey">Survey record</option>
                    <option value="note">Research note</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="classification">
                    Material classification
                  </label>
                  <select id="classification" name="classification">
                    <option value="finding">Real research</option>
                    <option value="hypothesis">
                      Hypothesis / planning note
                    </option>
                    <option value="fictional">Fictional example</option>
                  </select>
                </div>
              </div>
              <Field
                label="Participant reference (optional)"
                name="participant"
                maxLength={100}
                hint="Use an alias such as P01. Reuse the same alias for repeated records from the same person."
              />
              <Area
                label="Transcript, responses, or original notes"
                name="text"
                required
                rows={12}
                maxLength={250000}
                hint="For surveys, preserve question wording and response context. Separate participant records when counting independent voices."
              />
              <Field
                label="Tags (comma separated)"
                name="tags"
                placeholder="Onboarding, Pricing, Team decisions"
              />
              <button disabled={!c.projectId} className="btn primary">
                Save research source
              </button>
            </Form>
          ) : (
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setUploading(true);
                c.setError("");
                const form = new FormData(e.currentTarget);
                form.set("projectId", c.projectId);
                try {
                  const r = await fetch(
                    `/api/v1/workspaces/${c.workspaceId}/upload`,
                    { method: "POST", body: form },
                  );
                  const result = await r.json();
                  if (!r.ok) throw Error(result.error);
                  await c.refresh();
                  c.go("research/" + result.id);
                } catch (e) {
                  c.setError(e instanceof Error ? e.message : "Upload failed.");
                } finally {
                  setUploading(false);
                }
              }}
            >
              <h2 className="serif">Upload a research source.</h2>
              <div className="dropzone stack">
                <Icon name="upload" />
                <h3>Make room for the original.</h3>
                <p>PDF, TXT, MD, or CSV · up to 10 MB</p>
                <Field
                  label="Research file"
                  name="file"
                  type="file"
                  accept=".pdf,.txt,.md,.csv"
                  required
                />
              </div>
              <Notice>
                Files are stored privately. Security checks and text extraction
                run in the background. Processing failures remain visible and
                can be retried.
              </Notice>
              <button
                className="btn primary"
                disabled={uploading || !canEdit(c.data.role) || !c.projectId}
              >
                {uploading ? "Uploading…" : "Upload privately"}
              </button>
            </form>
          )}
        </div>
        <aside className="stack">
          <div className="card soft stack">
            <h2>Keep people in the picture.</h2>
            <p>
              Use participant aliases, preserve consent context, and remove
              unnecessary personal information before uploading.
            </p>
            <p>
              Research is private by default. Project owners decide whether
              viewers can read raw sources.
            </p>
          </div>
          <div className="card stack sm">
            <h3>From a passage to an observation.</h3>
            <p>
              Pick exact words from a source. Write what they suggest. Keep the
              quote and interpretation separate.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
function SourceDetail({ ctx: c, id }: { ctx: WorkspaceContext; id: string }) {
  const [source, setSource] = useState<Source | null>(null),
    [quote, setQuote] = useState(""),
    [start, setStart] = useState(0);
  const { workspaceId, setError } = c;
  async function load() {
    try {
      setSource(await api<Source>(`workspaces/${workspaceId}/sources/${id}`));
    } catch (e) {
      c.setError(e instanceof Error ? e.message : "Could not load source.");
    }
  }
  useEffect(() => {
    let active = true;
    api<Source>(`workspaces/${workspaceId}/sources/${id}`)
      .then((s) => {
        if (active) setSource(s);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, workspaceId, setError]);
  if (!source) return <Spinner />;
  const observations = c.data.observations.filter((o) => o.sourceId === id);
  return (
    <>
      <PageTitle
        title={source.title}
        description={`${source.kind} · ${source.participant || "Participant not specified"} · ${source.classification}`}
      >
        <ButtonLink href={c.href("research")} tone="">
          Research library
        </ButtonLink>
        {source.fileName && source.status === "ready" && (
          <a
            href={`/api/v1/workspaces/${c.workspaceId}/files/${source.id}`}
            className="btn"
          >
            <Icon name="download" />
            Original file
          </a>
        )}
      </PageTitle>
      {source.status !== "ready" ? (
        <div className="card stack">
          <Pill tone={source.status === "failed" ? "red" : "amber"}>
            {source.status}
          </Pill>
          <h2>
            {source.status === "failed"
              ? "Let’s recover this source."
              : "Your source is being prepared."}
          </h2>
          <p>
            {source.failure ||
              "Security checks and text extraction run in the background."}
          </p>
          <div className="row">
            <button className="btn" onClick={() => void load()}>
              Check progress
            </button>
            {source.status === "failed" && (
              <button
                className="btn primary"
                onClick={async () => {
                  await c.run({ action: "source.retry", sourceId: id });
                  await load();
                }}
              >
                Retry processing
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="split">
          <div className="stack">
            <div className="card stack">
              <div className="row between">
                <h2 className="serif">Original source</h2>
                <Pill>{source.classification}</Pill>
              </div>
              <p className="small">
                Select an exact passage to start an observation. The source text
                stays preserved.
              </p>
              <label htmlFor="source-text" className="sr-only">
                Source text, select a passage
              </label>
              <textarea
                id="source-text"
                className="transcript"
                readOnly
                rows={20}
                value={source.text}
                onSelect={(e) => {
                  const el = e.currentTarget;
                  if (el.selectionEnd > el.selectionStart) {
                    setQuote(
                      el.value.slice(el.selectionStart, el.selectionEnd),
                    );
                    setStart(el.selectionStart);
                  }
                }}
              />
            </div>
            {c.data.role === "owner" && (
              <button
                className="btn danger"
                onClick={() => {
                  if (
                    confirm(
                      "Remove this source? Cited sources require a recorded privacy redaction to preserve research provenance.",
                    )
                  )
                    void c.run({ action: "source.delete", sourceId: id }, () =>
                      c.go("research"),
                    );
                }}
              >
                Remove source
              </button>
            )}
          </div>
          <aside className="stack">
            <div className="card stack">
              <h2 className="serif">Capture the observation.</h2>
              <Form
                busy={c.busy || !canEdit(c.data.role)}
                onSubmit={async (f) => {
                  await c.run({
                    action: "observation.create",
                    sourceId: id,
                    quote,
                    insight: String(f.get("insight")),
                    start,
                    tags: String(f.get("tags") || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    classification: source.classification,
                  });
                }}
              >
                <Area
                  label="Exact source passage"
                  name="quote"
                  required
                  value={quote}
                  onChange={(e) => {
                    setQuote(e.target.value);
                    setStart(Math.max(0, source.text.indexOf(e.target.value)));
                  }}
                  maxLength={4000}
                />
                <Area
                  label="What does this suggest?"
                  name="insight"
                  required
                  maxLength={2000}
                  hint="Your interpretation is separate from the participant’s words."
                />
                <Field label="Tags (comma separated)" name="tags" />
                <Pill>{source.classification}</Pill>
                <button className="btn primary">Save observation</button>
              </Form>
            </div>
            <div className="card stack">
              <h3>{observations.length} saved observations</h3>
              {observations.map((o) => (
                <div className="evidence-item stack sm" key={o.id}>
                  <blockquote>“{o.quote}”</blockquote>
                  <p>{o.insight}</p>
                  <Pill tone="">{o.classification}</Pill>
                </div>
              ))}
            </div>
          </aside>
          {c.data.role === "owner" && (
            <button
              className="btn danger"
              onClick={() => {
                if (
                  !confirm(
                    "Privacy redaction removes this source and every associated persona revision, revokes affected shares, and invalidates exports. Existing downloaded copies cannot be recalled. Continue?",
                  )
                )
                  return;
                const reason = prompt(
                  "Record the reason for this privacy redaction (at least 10 characters):",
                );
                if (reason && reason.trim().length >= 10)
                  void c.run(
                    { action: "source.redact", sourceId: id, reason },
                    () => c.go("research"),
                  );
              }}
            >
              Redact source & affected insights
            </button>
          )}
        </div>
      )}
    </>
  );
}
