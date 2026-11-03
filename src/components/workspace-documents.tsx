"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { canEdit } from "@/lib/domain";
import type { WorkspaceContext } from "./workspace";
import { EvidenceSelect } from "./workspace-shared";
import { Icon, ButtonLink, Pill, Notice, Field, Area, PageTitle } from "./ui";
type Content = {
  body: string;
  personaIds: string[];
  observationIds: string[];
  stages: {
    name: string;
    goal: string;
    friction: string;
    opportunity: string;
    observationIds: string[];
  }[];
};
export function DocumentView({
  ctx: c,
  kind,
}: {
  ctx: WorkspaceContext;
  kind: "journey" | "brief";
}) {
  const search = useSearchParams();
  const selected = c.data.documents.find(
    (d) => d.id === search.get("document") && d.kind === kind,
  );
  const content = (selected?.content as unknown as Content) || {
    body: "",
    personaIds: [],
    observationIds: [],
    stages:
      kind === "journey"
        ? [
            {
              name: "Discover",
              goal: "",
              friction: "",
              opportunity: "",
              observationIds: [],
            },
            {
              name: "Evaluate",
              goal: "",
              friction: "",
              opportunity: "",
              observationIds: [],
            },
            {
              name: "Decide",
              goal: "",
              friction: "",
              opportunity: "",
              observationIds: [],
            },
          ]
        : [],
  };
  return (
    <>
      <PageTitle
        title={
          kind === "journey"
            ? "See the experience unfold."
            : "Give the insight a useful next step."
        }
        description={
          kind === "journey"
            ? "Map the moments, friction, and opportunities your research suggests."
            : "Turn audience knowledge into a proposal your team can test."
        }
      >
        <ButtonLink
          href={c.href(kind === "journey" ? "journeys" : "briefs", {
            document: "",
          })}
          tone=""
          icon="plus"
        >
          New {kind}
        </ButtonLink>
      </PageTitle>
      <div className="row mb24">
        {c.data.documents
          .filter((d) => d.kind === kind)
          .map((d) => (
            <ButtonLink
              tone={d.id === selected?.id ? "primary" : ""}
              href={c.href(kind === "journey" ? "journeys" : "briefs", {
                document: d.id,
              })}
              key={d.id}
            >
              {d.title}
            </ButtonLink>
          ))}
      </div>
      <DocumentEditor
        key={(selected?.id || "new") + ":" + (selected?.version || 0)}
        ctx={c}
        kind={kind}
        selected={
          selected
            ? {
                id: selected.id,
                title: selected.title,
                version: selected.version,
              }
            : undefined
        }
        initial={content}
      />
    </>
  );
}
function DocumentEditor({
  ctx: c,
  kind,
  selected,
  initial,
}: {
  ctx: WorkspaceContext;
  kind: "journey" | "brief";
  selected?: { id: string; title: string; version: number };
  initial: Content;
}) {
  const [title, setTitle] = useState(selected?.title || ""),
    [content, setContent] = useState<Content>(structuredClone(initial));
  function stageUpdate(i: number, value: Partial<Content["stages"][number]>) {
    setContent({
      ...content,
      stages: content.stages.map((s, j) => (i === j ? { ...s, ...value } : s)),
    });
  }
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await c.run<{ id: string }>(
          {
            action: "document.save",
            projectId: c.projectId,
            documentId: selected?.id,
            expectedVersion: selected?.version,
            title,
            kind,
            content,
          },
          (r) =>
            c.go(kind === "journey" ? "journeys" : "briefs", {
              document: r.id,
            }),
        );
      }}
    >
      <fieldset
        className="form-fieldset stack"
        disabled={c.busy || !canEdit(c.data.role)}
      >
        <div className="card stack">
          <div className="row between">
            <h2 className="serif">
              {selected ? "Refine the " + kind : "Start a " + kind + "."}
            </h2>
            <Pill tone="amber">Proposal to validate</Pill>
          </div>
          <Field
            label={kind === "journey" ? "Journey name" : "Brief title"}
            name="title"
            required
            maxLength={150}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="stack sm">
            <span className="label">Audience personas</span>
            <div className="row">
              {c.data.personas.map((p) => (
                <label className="check" key={p.id}>
                  <input
                    type="checkbox"
                    checked={content.personaIds.includes(p.id)}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        personaIds: e.target.checked
                          ? [...content.personaIds, p.id]
                          : content.personaIds.filter((id) => id !== p.id),
                      })
                    }
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          <Area
            label={
              kind === "journey"
                ? "Context and questions"
                : "Decision, proposed action, and how you will test it"
            }
            name="body"
            value={content.body}
            onChange={(e) => setContent({ ...content, body: e.target.value })}
            maxLength={10000}
            rows={kind === "brief" ? 10 : 4}
          />
          <Notice>
            Journeys and briefs are interpretations and proposals. Supporting
            observations remain findings within their research sample;
            recommendations need validation.
          </Notice>
        </div>
        {kind === "journey" && (
          <>
            <div className="journey-grid">
              {content.stages.map((s, i) => (
                <div className="card journey-stage stack" key={i}>
                  <span className="stepnum">0{i + 1}</span>
                  <Field
                    label="Stage name"
                    id={"stage-" + i}
                    required
                    maxLength={100}
                    value={s.name}
                    onChange={(e) => stageUpdate(i, { name: e.target.value })}
                  />
                  <Area
                    label="Audience goal"
                    id={"goal-" + i}
                    value={s.goal}
                    onChange={(e) => stageUpdate(i, { goal: e.target.value })}
                    maxLength={1000}
                  />
                  <Area
                    label="Friction or challenge"
                    id={"friction-" + i}
                    value={s.friction}
                    onChange={(e) =>
                      stageUpdate(i, { friction: e.target.value })
                    }
                    maxLength={1000}
                  />
                  <Area
                    label="Opportunity to test"
                    id={"opportunity-" + i}
                    value={s.opportunity}
                    onChange={(e) =>
                      stageUpdate(i, { opportunity: e.target.value })
                    }
                    maxLength={1000}
                  />
                  <details>
                    <summary>
                      {s.observationIds.length} supporting observations
                    </summary>
                    <EvidenceSelect
                      ctx={c}
                      selected={s.observationIds}
                      onChange={(ids) =>
                        stageUpdate(i, { observationIds: ids })
                      }
                    />
                  </details>
                  <button
                    type="button"
                    className="text-link danger-text"
                    onClick={() =>
                      setContent({
                        ...content,
                        stages: content.stages.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove stage
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn"
              type="button"
              disabled={content.stages.length >= 15}
              onClick={() =>
                setContent({
                  ...content,
                  stages: [
                    ...content.stages,
                    {
                      name: "New stage",
                      goal: "",
                      friction: "",
                      opportunity: "",
                      observationIds: [],
                    },
                  ],
                })
              }
            >
              <Icon name="plus" />
              Add journey stage
            </button>
          </>
        )}
        <div className="card stack">
          <h3>Research behind this {kind}</h3>
          <details>
            <summary>
              {content.observationIds.length} linked observations · select
              evidence
            </summary>
            <div className="mt16">
              <EvidenceSelect
                ctx={c}
                selected={content.observationIds}
                onChange={(ids) =>
                  setContent({ ...content, observationIds: ids })
                }
              />
            </div>
          </details>
        </div>
        <div className="row end">
          <button className="btn primary" disabled={!c.projectId}>
            Save {kind}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
