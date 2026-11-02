"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type PersonaContent, personaContent, canEdit } from "@/lib/domain";
import { api } from "@/lib/client-api";
import type { WorkspaceContext, WorkspaceData } from "./workspace";
import { EvidenceSelect, Form } from "./workspace-shared";
import {
  Icon,
  ButtonLink,
  Pill,
  Notice,
  Field,
  Area,
  PageTitle,
  Empty,
} from "./ui";
type Revision = {
  id: string;
  number: number;
  content: PersonaContent;
  note: string;
  createdAt: string;
  approval: { id: string; createdAt: string } | null;
};
type History = {
  revisions: Revision[];
  comments: {
    id: string;
    revisionId: string;
    authorName: string;
    text: string;
    resolved: boolean;
    createdAt: string;
  }[];
};
const blank: PersonaContent = {
  name: "",
  subtitle: "",
  summary: "",
  classification: "hypothesis",
  claims: [],
};
export function PersonaEditor({
  ctx: c,
  section,
}: {
  ctx: WorkspaceContext;
  section: string;
}) {
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const p = c.selectedPersona;
  const search = useSearchParams();
  const requested = search.get("id");
  const [path, setPath] = useState<"manual" | "research" | "hypothesis" | null>(
      null,
    ),
    [ids, setIds] = useState<string[]>([]),
    [proposal, setProposal] = useState<PersonaContent | null>(null);
  if (section === "builder")
    return (
      <>
        <PageTitle
          title="Build a useful understanding."
          description="Start where you are. Keep the basis for every claim visible."
        />
        {!path ? (
          <div className="grid g3">
            {[
              [
                "research",
                "spark",
                "Start with research",
                "Choose observations and ask AI for a cited proposal to review.",
              ],
              [
                "manual",
                "people",
                "Build it yourself",
                "Write a persona, link evidence, and make it your own.",
              ],
              [
                "hypothesis",
                "book",
                "Explore a hypothesis",
                "Capture a starting idea and the questions you need to investigate.",
              ],
            ].map(([key, icon, title, text]) => (
              <button
                className="card path-card stack"
                key={key}
                disabled={!canEdit(c.data.role) || !c.projectId}
                onClick={() =>
                  setPath(key as "manual" | "research" | "hypothesis")
                }
              >
                <div className="iconbox">
                  <Icon name={icon as "spark" | "people" | "book"} />
                </div>
                <h2 className="serif">{title}</h2>
                <p>{text}</p>
                <span className="text-link">
                  Choose this path <Icon name="arrow" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="row mb24">
              <button
                className="btn"
                onClick={() => {
                  setPath(null);
                  setProposal(null);
                }}
              >
                Change starting path
              </button>
              <Pill>
                {path === "research"
                  ? "Research-assisted draft"
                  : path === "hypothesis"
                    ? "Hypothesis exploration"
                    : "Manual authoring"}
              </Pill>
            </div>
            {path === "research" && !proposal ? (
              <div className="split">
                <div className="card stack">
                  <h2 className="serif">Choose what the draft can know.</h2>
                  <EvidenceSelect ctx={c} selected={ids} onChange={setIds} />
                </div>
                <div className="card stack">
                  <h2>Describe the audience question.</h2>
                  <Notice>
                    AI proposals use only the observations you select. They are
                    never automatically approved or published.
                  </Notice>
                  {!c.data.integrations.ai && (
                    <Notice tone="amber">
                      AI is not configured. Use manual authoring to build a
                      persona with these same evidence links.
                    </Notice>
                  )}
                  <Form
                    busy={c.busy}
                    onSubmit={async (f) => {
                      await c.run<{ content: PersonaContent }>(
                        {
                          action: "ai",
                          projectId: c.projectId,
                          mode: "persona",
                          question: String(f.get("question")),
                          observationIds: ids,
                        },
                        (r) => setProposal(r.content),
                      );
                    }}
                  >
                    <Area
                      label="What should this persona help your team understand?"
                      name="question"
                      required
                      maxLength={2000}
                    />
                    <button
                      className="btn primary"
                      disabled={
                        !ids.length ||
                        !c.data.workspace.aiEnabled ||
                        !c.data.integrations.ai
                      }
                    >
                      Propose a cited draft
                    </button>
                  </Form>
                  <button className="btn" onClick={() => setPath("manual")}>
                    Continue manually
                  </button>
                </div>
              </div>
            ) : (
              <DraftEditor key="new" ctx={c} initial={proposal || blank} />
            )}
          </>
        )}
        {!c.projectId && (
          <Notice tone="amber">
            Create a project before building a persona.
          </Notice>
        )}
      </>
    );
  if (section === "review")
    return (
      <>
        <PageTitle
          title="Make the story ready."
          description="Review the evidence, discuss the draft, and approve an exact revision."
        />
        <div className="stack">
          {c.data.personas.filter(
            (p) => p.status === "review" || p.status === "changes_requested",
          ).length ? (
            c.data.personas
              .filter(
                (p) =>
                  p.status === "review" || p.status === "changes_requested",
              )
              .map((p) => (
                <div className="card row between" key={p.id}>
                  <div>
                    <Pill tone="amber">{p.status.replaceAll("_", " ")}</Pill>
                    <h2 className="serif mt16">{p.name}</h2>
                    <p>
                      Revision {p.version} · {p.classification}
                    </p>
                  </div>
                  <ButtonLink href={c.href("persona", { id: p.id })} tone="">
                    Review persona
                  </ButtonLink>
                </div>
              ))
          ) : (
            <Empty
              title="No drafts waiting for review."
              text="Editors can submit saved personas. Owners can then approve the exact revision or request changes."
              icon="comment"
            />
          )}
        </div>
      </>
    );
  if (section === "publish") return <Publishing ctx={c} />;
  if (!p || (requested && !c.data.personas.some((p) => p.id === requested)))
    return (
      <Empty
        title="This persona is unavailable."
        text="Choose a saved persona or create one in this project."
        icon="people"
      >
        <ButtonLink href={c.href("personas")}>Open library</ButtonLink>
      </Empty>
    );
  if (section === "history")
    return <RevisionHistory key={p.id} ctx={c} persona={p} />;
  return (
    <>
      <PageTitle
        title={p.name}
        description={`Saved revision ${p.version} · ${p.status.replaceAll("_", " ")} · ${p.classification}`}
      >
        <ButtonLink
          href={c.href("history", { id: p.id })}
          tone=""
          icon="history"
        >
          Revision history
        </ButtonLink>
        {p.status === "approved" && !hasUnsaved && (
          <ButtonLink href={c.href("publish", { id: p.id })} icon="share">
            Publish snapshot
          </ButtonLink>
        )}
      </PageTitle>
      <nav className="tabs mb24" aria-label="Persona sections">
        <a className="active" href="#profile">
          Profile & evidence
        </a>
        <a href="#review">Review & comments</a>
        <a href={c.href("journeys")}>Audience journey</a>
        <a href={c.href("compare")}>Compare</a>
      </nav>
      <DraftEditor
        key={p.id + ":" + p.version}
        ctx={c}
        initial={personaContent.parse(p.revisions[0].content)}
        onDirtyChange={setHasUnsaved}
        persona={p}
      />
      <ReviewPanel ctx={c} persona={p} unsaved={hasUnsaved} />
    </>
  );
}
function DraftEditor({
  ctx: c,
  initial,
  persona: p,
  onDirtyChange,
}: {
  ctx: WorkspaceContext;
  onDirtyChange?: (dirty: boolean) => void;
  initial: PersonaContent;
  persona?: WorkspaceData["personas"][number];
}) {
  const [content, setContent] = useState<PersonaContent>(
      structuredClone(initial),
    ),
    [dirty, setDirty] = useState(false);
  const edit = canEdit(c.data.role),
    selectedIds = [
      ...new Set(content.claims.flatMap((cl) => cl.observationIds)),
    ];
  function update(value: Partial<PersonaContent>) {
    setDirty(true);
    onDirtyChange?.(true);
    setContent({ ...content, ...value });
  }
  function claimUpdate(
    id: string,
    value: Partial<PersonaContent["claims"][number]>,
  ) {
    update({
      claims: content.claims.map((cl) =>
        cl.id === id ? { ...cl, ...value } : cl,
      ),
    });
  }
  return (
    <section id="profile" className="split">
      <div className="stack">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await c.run<{ id: string; version: number }>(
              {
                action: "persona.save",
                projectId: c.projectId,
                personaId: p?.id,
                expectedVersion: p?.version,
                content,
                note: "Updated persona profile",
              },
              (r) => {
                setDirty(false);
                c.go("persona", { id: r.id });
              },
            );
            if (result) setDirty(false);
          }}
        >
          <fieldset disabled={c.busy || !edit} className="form-fieldset stack">
            <div className="card stack">
              <div className="row between">
                <h2 className="serif">The audience, in context.</h2>
                <Pill tone={dirty ? "amber" : "brand"}>
                  {dirty ? "Unsaved changes" : p ? "Saved draft" : "New draft"}
                </Pill>
              </div>
              <div className="grid g2">
                <Field
                  label="Persona name"
                  name="name"
                  required
                  maxLength={100}
                  value={content.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="e.g. The deliberate buyer"
                />
                <div className="field">
                  <label htmlFor="classification">Overall classification</label>
                  <select
                    id="classification"
                    value={content.classification}
                    onChange={(e) =>
                      update({
                        classification: e.target
                          .value as PersonaContent["classification"],
                      })
                    }
                  >
                    {["hypothesis", "finding", "estimate", "fictional"].map(
                      (s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
              <Field
                label="One-line description"
                name="subtitle"
                maxLength={180}
                value={content.subtitle}
                onChange={(e) => update({ subtitle: e.target.value })}
              />
              <Area
                label="What should your team understand?"
                name="summary"
                required
                maxLength={4000}
                value={content.summary}
                onChange={(e) => update({ summary: e.target.value })}
              />
              <Notice>
                Optional demographic details need evidence or an explicit
                hypothesis label. Describe needs and behaviours before
                assumptions about identity.
              </Notice>
            </div>
            {(["goal", "behaviour", "challenge", "need"] as const).map(
              (section) => (
                <div key={section} className="card stack">
                  <div className="row between">
                    <h2 className="serif">
                      {
                        {
                          goal: "Goals",
                          behaviour: "Behaviours",
                          challenge: "Challenges",
                          need: "Needs",
                        }[section]
                      }
                    </h2>
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        update({
                          claims: [
                            ...content.claims,
                            {
                              id: crypto.randomUUID(),
                              section,
                              text: "",
                              classification: "hypothesis",
                              observationIds: [],
                              assumptions: "",
                            },
                          ],
                        })
                      }
                    >
                      <Icon name="plus" />
                      Add {section}
                    </button>
                  </div>
                  {content.claims
                    .filter((cl) => cl.section === section)
                    .map((cl, i) => (
                      <div className="claim-editor stack sm" key={cl.id}>
                        <Area
                          label={`${section} ${i + 1}`}
                          id={cl.id}
                          required
                          maxLength={2000}
                          value={cl.text}
                          onChange={(e) =>
                            claimUpdate(cl.id, { text: e.target.value })
                          }
                        />
                        <div className="row between">
                          <select
                            aria-label={`Classification for ${section} ${i + 1}`}
                            value={cl.classification}
                            onChange={(e) =>
                              claimUpdate(cl.id, {
                                classification: e.target
                                  .value as typeof cl.classification,
                              })
                            }
                          >
                            {[
                              "hypothesis",
                              "finding",
                              "estimate",
                              "fictional",
                            ].map((v) => (
                              <option value={v} key={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="text-link danger-text"
                            onClick={() =>
                              update({
                                claims: content.claims.filter(
                                  (x) => x.id !== cl.id,
                                ),
                              })
                            }
                          >
                            Remove claim
                          </button>
                        </div>
                        {cl.classification === "estimate" && (
                          <Area
                            label="Assumptions and calculation method"
                            id={cl.id + "-method"}
                            required
                            minLength={11}
                            maxLength={2000}
                            value={cl.assumptions}
                            onChange={(e) =>
                              claimUpdate(cl.id, {
                                assumptions: e.target.value,
                              })
                            }
                          />
                        )}
                        <details>
                          <summary>
                            {cl.observationIds.length} evidence links · choose
                            supporting observations
                          </summary>
                          <div className="mt16">
                            <EvidenceSelect
                              ctx={c}
                              selected={cl.observationIds}
                              onChange={(ids) =>
                                claimUpdate(cl.id, { observationIds: ids })
                              }
                            />
                          </div>
                        </details>
                      </div>
                    ))}
                  {!content.claims.some((cl) => cl.section === section) && (
                    <p className="small">
                      No {section} added. Keep it empty until you have something
                      useful to say.
                    </p>
                  )}
                </div>
              ),
            )}
            <div className="card row between sticky-save">
              <p className="small">
                {dirty
                  ? "Your changes need to be saved."
                  : "Saved revisions preserve your research history."}
              </p>
              <button className="btn primary" disabled={!c.projectId}>
                <Icon name="check" />
                {p ? "Save new revision" : "Save persona"}
              </button>
            </div>
          </fieldset>
        </form>
        {p && edit && (
          <div className="row">
            <button
              className="btn"
              disabled={c.busy}
              onClick={() =>
                void c.run<{ id: string }>(
                  { action: "persona.duplicate", personaId: p.id },
                  (r) => c.go("persona", { id: r.id }),
                )
              }
            >
              Duplicate persona
            </button>
            <button
              className="btn danger"
              disabled={c.busy}
              onClick={() => {
                if (
                  confirm(
                    "Archive this persona? Existing approved snapshots keep their own sharing controls.",
                  )
                )
                  void c.run(
                    { action: "persona.archive", personaId: p.id },
                    () => c.go("personas"),
                  );
              }}
            >
              Archive persona
            </button>
          </div>
        )}
      </div>
      <aside className="stack">
        <div className="card evidence-panel stack">
          <div className="row between">
            <h3>Evidence at a glance</h3>
            <Icon name="shield" />
          </div>
          <div className="row">
            <Pill>{selectedIds.length} observations</Pill>
            <Pill tone="amber">
              {
                content.claims.filter((cl) => cl.classification !== "finding")
                  .length
              }{" "}
              claims to investigate
            </Pill>
          </div>
          <p className="small">
            Findings require exact supporting passages. Source counts show
            coverage within your research sample.
          </p>
          {selectedIds.length ? (
            selectedIds.map((id) => {
              const o = c.data.observations.find((o) => o.id === id);
              return o ? (
                <Link
                  className="evidence-item stack sm"
                  href={c.href("research/" + o.sourceId)}
                  key={id}
                >
                  <Pill tone="">{o.classification}</Pill>
                  <blockquote>“{o.quote}”</blockquote>
                  <small>{o.source.title}</small>
                </Link>
              ) : (
                <Notice key={id} tone="amber">
                  A cited observation is no longer available to this role.
                </Notice>
              );
            })
          ) : (
            <div className="card soft">
              <p className="small">
                No evidence linked yet. A hypothesis is a useful starting point
                when labelled honestly.
              </p>
            </div>
          )}
          <ButtonLink href={c.href("research/new")} tone="" icon="plus">
            Add research
          </ButtonLink>
        </div>
        <div className="card soft stack sm">
          <h3>Make the next question clear.</h3>
          <p className="small">
            What evidence would make you change your mind? Who hasn’t been heard
            yet? Keep those questions in your next research brief.
          </p>
        </div>
      </aside>
    </section>
  );
}
function ReviewPanel({
  ctx: c,
  persona: p,
  unsaved,
}: {
  ctx: WorkspaceContext;
  unsaved: boolean;
  persona: WorkspaceData["personas"][number];
}) {
  const { workspaceId, setError } = c;
  const [history, setHistory] = useState<History | null>(null);
  useEffect(() => {
    let active = true;
    api<History>(`workspaces/${workspaceId}/personas/${p.id}`)
      .then((r) => {
        if (active) setHistory(r);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [workspaceId, p.id, p.version, setError]);
  return (
    <section id="review" className="split mt24">
      <div className="card stack">
        <div className="row between">
          <h2 className="serif">Review this revision.</h2>
          <Pill>{p.status.replaceAll("_", " ")}</Pill>
        </div>
        <p>
          Approval binds to revision {p.version}. Saving later changes creates a
          draft that needs a new review.
        </p>
        {unsaved && (
          <Notice tone="amber">
            Save your changes before reviewing or publishing this persona.
          </Notice>
        )}
        <div className="row">
          {p.status !== "review" && p.status !== "approved" && (
            <button
              className="btn primary"
              disabled={c.busy || unsaved || !canEdit(c.data.role)}
              onClick={() =>
                void c.run({
                  action: "persona.review",
                  personaId: p.id,
                  version: p.version,
                  type: "submit",
                })
              }
            >
              Submit revision {p.version} for review
            </button>
          )}
          {p.status === "review" && (
            <>
              <button
                className="btn primary"
                disabled={c.busy || unsaved || c.data.role !== "owner"}
                onClick={() =>
                  void c.run({
                    action: "persona.review",
                    personaId: p.id,
                    version: p.version,
                    type: "approve",
                  })
                }
              >
                Approve revision {p.version}
              </button>
              <button
                className="btn"
                disabled={c.busy || unsaved || c.data.role !== "owner"}
                onClick={() =>
                  void c.run({
                    action: "persona.review",
                    personaId: p.id,
                    version: p.version,
                    type: "changes",
                  })
                }
              >
                Request changes
              </button>
            </>
          )}
          {p.status === "approved" && !unsaved && (
            <ButtonLink href={c.href("publish", { id: p.id })} icon="share">
              Publish approved snapshot
            </ButtonLink>
          )}
        </div>
        {c.data.role !== "owner" && (
          <p className="small">A workspace owner approves and publishes.</p>
        )}
        <ButtonLink
          href={c.href("history", { id: p.id })}
          tone=""
          icon="history"
        >
          Inspect revision history
        </ButtonLink>
      </div>
      <div className="card stack">
        <h2>Keep the conversation close.</h2>
        {canEdit(c.data.role) && (
          <Form
            busy={c.busy}
            onSubmit={async (f) => {
              await c.run({
                action: "comment.add",
                personaId: p.id,
                version: p.version,
                text: String(f.get("text")),
              });
              setHistory(
                await api<History>(
                  `workspaces/${c.workspaceId}/personas/${p.id}`,
                ),
              );
            }}
          >
            <Area
              label={`Comment on revision ${p.version}`}
              name="text"
              required
              maxLength={3000}
            />
            <button className="btn">Add comment</button>
          </Form>
        )}
        {history?.comments.length ? (
          history.comments.map((comment) => (
            <div className="comment-card" key={comment.id}>
              <div className="row between">
                <strong>{comment.authorName}</strong>
                <Pill tone="">{comment.resolved ? "Resolved" : "Open"}</Pill>
              </div>
              <p className="mt16 preserve-lines">{comment.text}</p>
              <small>{new Date(comment.createdAt).toLocaleString()}</small>
              {!comment.resolved && canEdit(c.data.role) && (
                <button
                  className="text-link"
                  onClick={async () => {
                    await c.run({
                      action: "comment.resolve",
                      commentId: comment.id,
                    });
                    setHistory(
                      await api<History>(
                        `workspaces/${c.workspaceId}/personas/${p.id}`,
                      ),
                    );
                  }}
                >
                  Resolve comment
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="small">
            No comments yet. Ask a question about the evidence or suggest a
            clearer claim.
          </p>
        )}
      </div>
    </section>
  );
}
function RevisionHistory({
  ctx: c,
  persona: p,
}: {
  ctx: WorkspaceContext;
  persona: WorkspaceData["personas"][number];
}) {
  const { workspaceId, setError } = c;
  const [history, setHistory] = useState<History | null>(null),
    [selected, setSelected] = useState<Revision | null>(null);
  useEffect(() => {
    api<History>(`workspaces/${workspaceId}/personas/${p.id}`)
      .then(setHistory)
      .catch((e) => setError(e.message));
  }, [workspaceId, p.id, p.version, setError]);
  return (
    <>
      <PageTitle
        title="Room to change your mind."
        description={`${p.name} · every saved revision, preserved.`}
      >
        <ButtonLink href={c.href("persona", { id: p.id })} tone="">
          Back to persona
        </ButtonLink>
      </PageTitle>
      <Notice>
        Restoring creates a new draft revision. Existing history, approvals, and
        published snapshots remain intact.
      </Notice>
      <div className="split mt24">
        <div className="stack">
          {history?.revisions.map((r) => (
            <div className="card stack sm" key={r.id}>
              <div className="row between">
                <h3>Revision {r.number}</h3>
                <Pill>
                  {r.approval
                    ? "Approved"
                    : r.number === p.version
                      ? "Current"
                      : "Saved"}
                </Pill>
              </div>
              <p>{r.note}</p>
              <small>{new Date(r.createdAt).toLocaleString()}</small>
              <div className="row">
                <button className="btn" onClick={() => setSelected(r)}>
                  Compare with current
                </button>
                <button
                  className="btn"
                  disabled={
                    c.busy || !canEdit(c.data.role) || r.number === p.version
                  }
                  onClick={() => {
                    if (confirm(`Restore revision ${r.number} as a new draft?`))
                      void c.run(
                        {
                          action: "persona.restore",
                          personaId: p.id,
                          revisionId: r.id,
                          expectedVersion: p.version,
                        },
                        () => c.go("persona", { id: p.id }),
                      );
                  }}
                >
                  Restore as new draft
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="card stack">
          <h2 className="serif">
            {selected
              ? "Revision " + selected.number + " → " + p.version
              : "Choose a revision."}
          </h2>
          {selected ? (
            <>
              <h3>{selected.content.name}</h3>
              <p>{selected.content.summary}</p>
              <div className="rule" />
              <h3>Current summary</h3>
              <p>{p.summary}</p>
              <div className="rule" />
              {selected.content.claims.map((cl) => {
                const current = personaContent
                  .parse(p.revisions[0].content)
                  .claims.find((x) => x.id === cl.id);
                return (
                  <div className="card soft stack sm" key={cl.id}>
                    <Pill tone={current?.text === cl.text ? "" : "amber"}>
                      {!current
                        ? "Removed"
                        : current.text === cl.text
                          ? "Unchanged"
                          : "Changed"}
                    </Pill>
                    <p>{cl.text}</p>
                    {current && current.text !== cl.text && (
                      <p>
                        <strong>Now:</strong> {current.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <p>
              Select an earlier revision to inspect changes before restoring it.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
function Publishing({ ctx: c }: { ctx: WorkspaceContext }) {
  const [url, setUrl] = useState("");
  const approved = c.data.personas.filter((p) => p.status === "approved");
  return (
    <>
      <PageTitle
        title="Share a story you stand behind."
        description="Publish the approved version. Keep the raw research private."
      />
      <div className="split">
        <div className="card stack">
          <h2 className="serif">Create a controlled snapshot.</h2>
          <Notice>
            Snapshots contain the persona’s profile, claims, and citation IDs.
            Review the profile for personal information before sharing. Raw
            source documents and participant identities are excluded.
          </Notice>
          <Form
            busy={c.busy || c.data.role !== "owner"}
            onSubmit={async (f) => {
              const p = approved.find((p) => p.id === f.get("personaId"));
              if (!p) return;
              await c.run<{ url: string }>(
                {
                  action: "publish",
                  personaId: p.id,
                  version: p.version,
                  days: Number(f.get("days")),
                  membersOnly: f.get("visibility") === "members",
                  recipientEmail:
                    String(f.get("recipientEmail") || "") || undefined,
                  passphrase: String(f.get("passphrase") || "") || undefined,
                },
                (r) => setUrl(r.url),
              );
            }}
          >
            <div className="field">
              <label htmlFor="personaId">Approved persona</label>
              <select
                id="personaId"
                name="personaId"
                defaultValue={
                  approved.some((p) => p.id === c.selectedPersona?.id)
                    ? c.selectedPersona?.id
                    : undefined
                }
              >
                {approved.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · revision {p.version}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid g2">
              <div className="field">
                <label htmlFor="visibility">Who can view?</label>
                <select name="visibility" id="visibility">
                  <option value="link">Anyone with this private link</option>
                  <option value="members">
                    Permitted project members only
                  </option>
                </select>
              </div>
              <Field
                label="Expires in days"
                name="days"
                type="number"
                min={1}
                max={365}
                defaultValue={30}
                required
              />
            </div>
            <Field
              label="Restrict to one verified email (optional)"
              name="recipientEmail"
              type="email"
            />
            <Field
              label="Passphrase (optional, at least 8 characters)"
              name="passphrase"
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
            <label className="check">
              <input type="checkbox" required />I have reviewed this approved
              revision and its classification for sharing.
            </label>
            <button
              className="btn primary"
              disabled={!approved.length || c.data.role !== "owner"}
            >
              <Icon name="share" />
              Publish snapshot & create link
            </button>
          </Form>
          {!approved.length && (
            <Notice tone="amber">
              Approve a saved persona revision before publishing.
            </Notice>
          )}
          {url && (
            <div className="stack">
              <Notice>
                Your snapshot is published. Save this link now; its token is not
                stored in readable form.
              </Notice>
              <Field
                label="Share link"
                value={url}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <a href={url} className="btn" target="_blank" rel="noreferrer">
                Open shared snapshot <Icon name="external" />
              </a>
            </div>
          )}
        </div>
        <aside className="stack">
          <div className="card stack">
            <h2>Sharing controls</h2>
            {c.data.shares.length ? (
              c.data.shares.map((s) => (
                <div className="share-row stack sm" key={s.id}>
                  <div className="row between">
                    <strong>Snapshot {s.snapshotId.slice(-6)}</strong>
                    <Pill tone={s.revokedAt ? "red" : "brand"}>
                      {s.revokedAt
                        ? "Revoked"
                        : new Date(s.expiresAt) < new Date()
                          ? "Expired"
                          : "Active"}
                    </Pill>
                  </div>
                  <p className="small">
                    {s.recipientEmail ||
                      (s.membersOnly ? "Project members" : "Private link")}{" "}
                    · expires {new Date(s.expiresAt).toLocaleDateString()}
                  </p>
                  <button
                    className="btn danger"
                    disabled={!!s.revokedAt || c.busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Revoke this share now? Future requests will be denied. Downloaded files cannot be recalled.",
                        )
                      )
                        void c.run({ action: "share.revoke", shareId: s.id });
                    }}
                  >
                    Revoke access
                  </button>
                </div>
              ))
            ) : (
              <p>No share links yet.</p>
            )}
          </div>
          <div className="card soft stack sm">
            <h3>Take approved work with you.</h3>
            <p>
              PDF and CSV exports preserve classification, revision, and
              citation references.
            </p>
            <ButtonLink href={c.href("exports")} tone="" icon="download">
              Open export centre
            </ButtonLink>
          </div>
        </aside>
      </div>
    </>
  );
}
