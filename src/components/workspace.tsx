"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Serialized, ApiError } from "@/lib/client-api";
import { authClient } from "@/lib/auth-client";
import {
  type PersonaContent,
  personaContent,
  canEdit,
  plans,
} from "@/lib/domain";
import type { workspaceData } from "@/server/queries";
import type { Command } from "@/server/commands";
import {
  Logo,
  Icon,
  type IconName,
  ButtonLink,
  Pill,
  Notice,
  Field,
  Area,
  PageTitle,
  Empty,
  Portrait,
  Spinner,
} from "./ui";
import { Form, EvidenceSelect, PageControls } from "./workspace-shared";
import { PersonaEditor } from "./workspace-persona";
import { ResearchView } from "./workspace-research";
import { DocumentView } from "./workspace-documents";
type Data = Serialized<Awaited<ReturnType<typeof workspaceData>>>;
type Me = {
  user: { id: string; name: string; email: string };
  workspaces: {
    role: string;
    workspace: { id: string; name: string; demo: boolean };
  }[];
};
export type WorkspaceContext = {
  data: Data;
  me: Me;
  busy: boolean;
  run: <T = Record<string, unknown>>(
    command: Command,
    success?: (result: T) => void,
  ) => Promise<T | undefined>;
  refresh: () => Promise<void>;
  href: (page: string, extra?: Record<string, string>) => string;
  go: (page: string, extra?: Record<string, string>) => void;
  workspaceId: string;
  projectId: string;
  selectedPersona: Data["personas"][number] | undefined;
  error: string;
  setError: (s: string) => void;
};
export type WorkspaceData = Data;
const navigation: [string, IconName, string][] = [
  ["Overview", "grid", ""],
  ["Projects", "folder", "projects"],
  ["Research library", "file", "research"],
  ["Persona library", "people", "personas"],
  ["Audience journeys", "route", "journeys"],
  ["Compare audiences", "compare", "compare"],
  ["Ask your research", "spark", "ask"],
  ["Research gaps", "search", "gaps"],
  ["Action briefs", "book", "briefs"],
  ["Review & approval", "comment", "review"],
  ["Publishing", "share", "publish"],
  ["Export centre", "download", "exports"],
];
export function Workspace({ section }: { section: string }) {
  const search = useSearchParams(),
    router = useRouter();
  const requestedWorkspace = search.get("workspace") || "",
    requestedProject = search.get("project") || "",
    personaId = search.get("id") || "";
  const [me, setMe] = useState<Me | null>(null),
    [data, setData] = useState<Data | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [open, setOpen] = useState(false);
  const workspaceId =
    requestedWorkspace || me?.workspaces[0]?.workspace.id || "";
  const query = search.get("q") || "",
    page = search.get("page") || "1",
    kind = search.get("kind") || "",
    status = search.get("status") || "";
  const dataQuery = new URLSearchParams({
    ...(requestedProject ? { project: requestedProject } : {}),
    ...(["personas", "research"].includes(section)
      ? {
          q: query,
          page,
          kind: section === "research" ? kind : "",
          status: section === "personas" ? status : "",
        }
      : {}),
    ...(["persona", "history", "publish"].includes(section) && personaId
      ? { personaId }
      : {}),
    ...(section.startsWith("research/") && section !== "research/new"
      ? { sourceId: section.split("/")[1] }
      : {}),
  }).toString();
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = sidebarRef.current;
    if (!panel) return;
    const controls = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a,button,select,input,[tabindex="0"]',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
    controls()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const nodes = controls(),
          first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  async function refresh() {
    if (!workspaceId) return;
    const next = await api<Data>(`workspaces/${workspaceId}/data?${dataQuery}`);
    setData(next);
  }
  useEffect(() => {
    let active = true;
    api<Me>("me")
      .then((result) => {
        if (!active) return;
        setMe(result);
        if (!result.workspaces.length) router.replace("/onboarding");
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [router]);
  useEffect(() => {
    let active = true;
    if (workspaceId)
      api<Data>(`workspaces/${workspaceId}/data?${dataQuery}`)
        .then((r) => {
          if (active) setData(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [workspaceId, dataQuery]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  function href(page: string, extra: Record<string, string> = {}) {
    const qs = new URLSearchParams({
      workspace: workspaceId,
      ...(data?.selectedProject ? { project: data.selectedProject } : {}),
      ...extra,
    });
    return "/app" + (page ? "/" + page : "") + "?" + qs.toString();
  }
  function go(page: string, extra: Record<string, string> = {}) {
    router.push(href(page, extra));
  }
  async function run<T = Record<string, unknown>>(
    c: Command,
    success?: (r: T) => void,
  ): Promise<T | undefined> {
    setBusy(true);
    setError("");
    try {
      const result = await api<T>(`workspaces/${workspaceId}/commands`, c);
      try {
        await refresh();
      } catch {
        setError(
          "Your change was saved, but the view could not refresh. Reload to see the latest work.",
        );
      }
      setToast("Saved to your workspace.");
      success?.(result);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your work.");
      if (e instanceof ApiError && e.status === 401)
        router.push(
          "/login?next=" +
            encodeURIComponent(location.pathname + location.search),
        );
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  if (
    !data ||
    !me ||
    data.workspace.id !== workspaceId ||
    (requestedProject && data.selectedProject !== requestedProject)
  )
    return (
      <main id="main" className="not-found stack">
        <Logo />
        {error ? (
          <>
            <Notice tone="red">{error}</Notice>
            <ButtonLink href="/login">Sign in</ButtonLink>
            <button className="btn" onClick={() => location.reload()}>
              Retry
            </button>
          </>
        ) : (
          <Spinner />
        )}
      </main>
    );
  const projectId = data.selectedProject || "",
    selectedPersona =
      data.personas.find((p) => p.id === personaId) || data.personas[0];
  const ctx: WorkspaceContext = {
    data,
    me,
    busy,
    run,
    refresh,
    href,
    go,
    workspaceId,
    projectId,
    selectedPersona,
    error,
    setError,
  };
  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        ref={sidebarRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Workspace navigation"
      >
        <Logo />
        <button className="btn mobile-menu" onClick={() => setOpen(false)}>
          Close navigation
        </button>
        <div className="workspace-switch">
          <label className="small" htmlFor="workspace-switch">
            Workspace
          </label>
          <select
            id="workspace-switch"
            value={workspaceId}
            onChange={(e) => router.push("/app?workspace=" + e.target.value)}
          >
            {me.workspaces.map((m) => (
              <option key={m.workspace.id} value={m.workspace.id}>
                {m.workspace.name}
                {m.workspace.demo ? " · demonstration" : ""}
              </option>
            ))}
          </select>
          <Pill tone="">{data.role}</Pill>
        </div>
        <nav
          className="sidenav"
          aria-label="Research workspace"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
        >
          {navigation.map(([label, icon, page]) => (
            <Link
              className={
                section === page ||
                (section === "builder" && page === "personas") ||
                (section === "persona" && page === "personas") ||
                (section === "history" && page === "review")
                  ? "active"
                  : ""
              }
              key={page}
              href={href(page)}
            >
              <Icon name={icon} />
              {label}
              {page === "review" &&
              data.personas.some((p) => p.status === "review") ? (
                <span className="nav-count">
                  {data.personas.filter((p) => p.status === "review").length}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href={href("team")}>
            <Icon name="people" />
            Team & access
          </Link>
          <Link href={href("billing")}>
            <Icon name="card" />
            Plan & billing
          </Link>
          <Link href={href("settings")}>
            <Icon name="settings" />
            Workspace settings
          </Link>
          <Link href={href("support")}>
            <Icon name="help" />
            Help & support
          </Link>
        </div>
      </aside>
      {open && (
        <button
          className="drawer-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="app-main" inert={open ? true : undefined}>
        <header className="appbar">
          <div className="row">
            <button
              className="btn icon-only mobile-menu"
              onClick={() => setOpen(!open)}
              aria-label="Toggle workspace navigation"
              aria-expanded={open}
            >
              <Icon name="menu" />
            </button>
            <div className="breadcrumb">
              <Link href={href("projects")}>{data.workspace.name}</Link>
              <span>/</span>
              <select
                aria-label="Active project"
                value={projectId}
                onChange={(e) =>
                  router.push(
                    "/app?workspace=" +
                      workspaceId +
                      "&project=" +
                      e.target.value,
                  )
                }
              >
                {!projectId && <option value="">Choose a project</option>}
                {data.projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                    {p.restricted ? " · restricted" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row">
            <Link
              className="btn icon-only"
              href={href("notifications")}
              aria-label="Notifications"
            >
              <Icon name="bell" />
              {data.notifications.some((n) => !n.readAt) && (
                <span className="notification-dot" />
              )}
            </Link>
            <span className="avatar" title={me.user.name}>
              {me.user.name.slice(0, 2).toUpperCase()}
            </span>
            <button
              className="btn icon-only"
              aria-label="Sign out"
              onClick={async () => {
                setData(null);
                await authClient.signOut();
                router.replace("/login");
                router.refresh();
              }}
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className="app-content" id="main">
          <div className="content-limit">
            {data.workspace.demo && (
              <div className="notice amber mb24">
                Demonstration workspace · all research and personas are
                fictional examples.
              </div>
            )}
            {data.role === "viewer" && (
              <div className="notice mb24">
                Viewer access · you can read permitted project content. Editing
                and publishing require a different role.
              </div>
            )}
            {error && (
              <div className="mb24">
                <Notice tone="red">{error}</Notice>
              </div>
            )}
            {!section ? (
              <Overview ctx={ctx} />
            ) : section === "projects" || section === "project" ? (
              <Projects ctx={ctx} settings={section === "project"} />
            ) : section === "research" || section.startsWith("research/") ? (
              <ResearchView ctx={ctx} section={section} />
            ) : section === "builder" ||
              section === "persona" ||
              section === "history" ||
              section === "review" ||
              section === "publish" ? (
              <PersonaEditor
                key={
                  section +
                  ":" +
                  (selectedPersona?.id || "new") +
                  ":" +
                  (selectedPersona?.version || 0)
                }
                ctx={ctx}
                section={section}
              />
            ) : section === "personas" ? (
              <PersonaLibrary ctx={ctx} />
            ) : section === "journeys" || section === "briefs" ? (
              <DocumentView
                ctx={ctx}
                kind={section === "journeys" ? "journey" : "brief"}
              />
            ) : section === "compare" ? (
              <Compare ctx={ctx} />
            ) : section === "ask" ? (
              <Ask ctx={ctx} />
            ) : section === "gaps" ? (
              <Gaps ctx={ctx} />
            ) : section === "exports" ? (
              <Exports ctx={ctx} />
            ) : section === "team" ? (
              <Team ctx={ctx} />
            ) : section === "settings" ? (
              <Settings ctx={ctx} />
            ) : section === "billing" || section === "checkout" ? (
              <Billing ctx={ctx} />
            ) : section === "support" ? (
              <Support ctx={ctx} />
            ) : section === "notifications" ? (
              <Notifications ctx={ctx} />
            ) : (
              <Empty
                title="Page not found"
                text="Choose a page from the workspace navigation."
              />
            )}
          </div>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" />
          {toast}
        </div>
      )}
      {busy && (
        <div className="save-indicator" role="status">
          Saving…
        </div>
      )}
    </div>
  );
}

function Overview({ ctx: c }: { ctx: WorkspaceContext }) {
  const d = c.data;
  return (
    <>
      <PageTitle
        title="A clearer picture, together."
        description={`Welcome back, ${c.me.user.name.split(" ")[0]}. Here’s where your audience work stands.`}
      >
        {canEdit(d.role) && (
          <ButtonLink href={c.href("builder")} icon="plus">
            Build a persona
          </ButtonLink>
        )}
      </PageTitle>
      <div className="grid g4 mb24">
        {[
          ["Research sources", d.counts.sources, "file"],
          ["Saved personas", d.counts.personas, "people"],
          ["Awaiting review", d.counts.review, "comment"],
          ["Published snapshots", d.counts.snapshots, "share"],
        ].map(([label, n, icon]) => (
          <div className="card metric" key={label}>
            <div className="row between">
              <span className="mini-count">{n}</span>
              <Icon name={icon as IconName} />
            </div>
            <p>{label}</p>
          </div>
        ))}
      </div>
      <section className="split">
        <div className="stack">
          <div className="section-head compact">
            <h2 className="serif">Your audience work</h2>
            <Link className="text-link" href={c.href("personas")}>
              View library <Icon name="arrow" />
            </Link>
          </div>
          {d.personas.length ? (
            <div className="grid g2">
              {d.personas.slice(0, 4).map((p, i) => (
                <PersonaCard key={p.id} persona={p} index={i} ctx={c} />
              ))}
            </div>
          ) : (
            <Empty
              title="Meet your first persona."
              text="Start with your research, write a profile yourself, or explore a clearly labelled hypothesis."
              icon="people"
            >
              <ButtonLink href={c.href("builder")}>Create a persona</ButtonLink>
            </Empty>
          )}
        </div>
        <aside className="stack">
          <div className="card dark stack">
            <div className="eyebrow">Your next useful step</div>
            <h2 className="serif">
              Let the evidence
              <br />
              lead the way.
            </h2>
            <p>
              {d.observations.length
                ? "Your observations are ready to support a persona draft."
                : "Add a research source, then capture a passage that helps explain an audience need."}
            </p>
            <ButtonLink
              href={c.href(d.observations.length ? "builder" : "research/new")}
              tone="apricot"
              icon="arrow"
            >
              {d.observations.length
                ? "Build from research"
                : "Add your first source"}
            </ButtonLink>
          </div>
          <div className="card stack sm">
            <h3>Research with intention.</h3>
            <p className="small">
              Findings need evidence. Estimates need a method. Hypotheses need a
              next question.
            </p>
            <Link className="text-link" href="/methodology">
              Our methodology <Icon name="external" />
            </Link>
          </div>
          <div className="card">
            <h3 className="mb16">Recent activity</h3>
            {d.audit.length ? (
              d.audit.slice(0, 4).map((a) => (
                <div className="listitem" key={a.id}>
                  <Icon name="clock" />
                  <div>
                    <strong className="small">
                      {a.action.replaceAll(".", " · ")}
                    </strong>
                    <p className="small">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="small">
                Your team’s saved actions will appear here.
              </p>
            )}
          </div>
        </aside>
      </section>
    </>
  );
}
export function PersonaCard({
  persona: p,
  index = 0,
  ctx: c,
}: {
  persona: Data["personas"][number];
  index?: number;
  ctx: WorkspaceContext;
}) {
  return (
    <Link
      href={c.href("persona", { id: p.id })}
      className="card persona-card click"
    >
      <Portrait tone={index} />
      <div className="details stack sm">
        <div className="row between">
          <Pill>{p.classification}</Pill>
          <Pill tone={p.status === "approved" ? "brand" : "amber"}>
            {p.status.replaceAll("_", " ")}
          </Pill>
        </div>
        <h3 className="serif">{p.name}</h3>
        <p>{p.summary || "An audience profile ready to develop."}</p>
        <div className="row between small muted">
          <span>Revision {p.version}</span>
          <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  );
}
function PersonaLibrary({ ctx: c }: { ctx: WorkspaceContext }) {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || ""),
    [status, setStatus] = useState(params.get("status") || "all");
  const list = c.data.personas;
  return (
    <>
      <PageTitle
        title="Your persona library."
        description="Saved audience knowledge. Room to learn something new."
      >
        {canEdit(c.data.role) && (
          <ButtonLink href={c.href("builder")} icon="plus">
            Create persona
          </ButtonLink>
        )}
      </PageTitle>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          c.go("personas", {
            q,
            status: status === "all" ? "" : status,
            page: "1",
          });
        }}
      >
        <div className="search">
          <Icon name="search" />
          <input
            aria-label="Search personas"
            placeholder="Search your personas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by review status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Every status</option>
          {["draft", "review", "approved", "changes_requested"].map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button className="btn" type="submit">
          Search library
        </button>
        <span className="muted small">
          {c.data.pagination.personaMatches} matching personas
        </span>
      </form>
      {list.length ? (
        <div className="grid g3">
          {list.map((p, i) => (
            <PersonaCard persona={p} index={i} ctx={c} key={p.id} />
          ))}
        </div>
      ) : (
        <Empty
          title={q ? "No matching personas." : "Your library starts here."}
          text={
            q
              ? "Try a different name or status."
              : "Create a persona and return to it whenever your research grows."
          }
          icon="people"
        >
          <ButtonLink href={c.href("builder")}>
            Build your first persona
          </ButtonLink>
        </Empty>
      )}
      <PageControls
        page={c.data.pagination.page}
        total={c.data.pagination.personaMatches}
        onPage={(page) =>
          c.go("personas", {
            q,
            status: status === "all" ? "" : status,
            page: String(page),
          })
        }
      />
    </>
  );
}
function Projects({
  ctx: c,
  settings,
}: {
  ctx: WorkspaceContext;
  settings: boolean;
}) {
  const p = c.data.projects.find((p) => p.id === c.projectId);
  return (
    <>
      <PageTitle
        title={settings ? "Project settings." : "A place for every audience."}
        description="Keep products, clients, and research questions in their own space."
      />
      <div className="split">
        <div className="stack">
          {c.data.projects.map((p) => (
            <div className="card row between" key={p.id}>
              <div className="row">
                <div className="iconbox">
                  <Icon name="folder" />
                </div>
                <div>
                  <h3>{p.name}</h3>
                  <p className="small">
                    {p.description || "A fresh research project."}
                  </p>
                  <Pill tone="">
                    {p.restricted ? "Restricted project" : "Workspace project"}
                  </Pill>
                </div>
              </div>
              <ButtonLink href={c.href("project", { project: p.id })} tone="">
                Open project
              </ButtonLink>
            </div>
          ))}
        </div>
        <div className="card stack">
          <h2 className="serif">
            {settings && p ? "Refine this space." : "Create a project."}
          </h2>
          {canEdit(c.data.role) ? (
            <Form
              key={p?.id + (settings ? "settings" : "new")}
              busy={c.busy || (settings && c.data.role !== "owner")}
              onSubmit={async (f) => {
                if (settings && p)
                  await c.run({
                    action: "project.update",
                    projectId: p.id,
                    name: String(f.get("name")),
                    description: String(f.get("description")),
                    restricted: f.has("restricted"),
                    viewerResearch: f.has("viewerResearch"),
                    memberIds: f.getAll("memberIds").map(String),
                  });
                else
                  await c.run<{ id: string }>(
                    {
                      action: "project.create",
                      name: String(f.get("name")),
                      description: String(f.get("description")),
                      restricted: f.has("restricted"),
                      viewerResearch: f.has("viewerResearch"),
                    },
                    (r) => c.go("", { project: r.id }),
                  );
              }}
            >
              <Field
                label="Project name"
                name="name"
                defaultValue={settings ? p?.name : ""}
                required
                maxLength={100}
              />
              <Area
                label="What are you trying to understand?"
                name="description"
                defaultValue={settings ? p?.description : ""}
                maxLength={1000}
              />
              <label className="check">
                <input
                  type="checkbox"
                  name="restricted"
                  defaultChecked={settings ? p?.restricted : false}
                />
                Restrict this project to selected members
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="viewerResearch"
                  defaultChecked={settings ? p?.viewerResearch : false}
                />
                Let project viewers read raw research
              </label>
              {settings && c.data.role === "owner" && (
                <div className="stack sm">
                  <span className="label">Project members</span>
                  {c.data.team.map((m) => (
                    <label key={m.id} className="check">
                      <input
                        type="checkbox"
                        name="memberIds"
                        value={m.userId}
                        defaultChecked={p?.members.some(
                          (pm) => pm.userId === m.userId,
                        )}
                      />
                      {m.user.name} · {m.role}
                    </label>
                  ))}
                </div>
              )}
              <button className="btn primary">
                {settings ? "Save project settings" : "Create project"}
              </button>
            </Form>
          ) : (
            <Notice>Ask an owner or editor to create a project.</Notice>
          )}
        </div>
      </div>
    </>
  );
}
function Compare({ ctx: c }: { ctx: WorkspaceContext }) {
  const [ids, setIds] = useState<string[]>(
    c.data.personas.slice(0, 2).map((p) => p.id),
  );
  const selected = c.data.personas.filter((p) => ids.includes(p.id));
  return (
    <>
      <PageTitle
        title="Find the meaningful differences."
        description="Compare needs and behaviours with their evidence still attached."
      />
      <div className="card row mb24">
        {c.data.personas.map((p) => (
          <label className="check" key={p.id}>
            <input
              type="checkbox"
              checked={ids.includes(p.id)}
              disabled={!ids.includes(p.id) && ids.length >= 3}
              onChange={(e) =>
                setIds(
                  e.target.checked
                    ? [...ids, p.id]
                    : ids.filter((id) => id !== p.id),
                )
              }
            />
            {p.name}
          </label>
        ))}
      </div>
      {selected.length ? (
        <div className="grid g3">
          {selected.map((p) => {
            const content = personaContent.parse(p.revisions[0].content);
            return (
              <div className="card stack" key={p.id}>
                <Pill>{content.classification}</Pill>
                <h2 className="serif">{p.name}</h2>
                <p>{p.summary}</p>
                {["goal", "behaviour", "challenge", "need"].map((section) => (
                  <div className="stack sm" key={section}>
                    <h3>{section}</h3>
                    {content.claims
                      .filter((cl) => cl.section === section)
                      .map((cl) => (
                        <div key={cl.id}>
                          <p>{cl.text}</p>
                          <Pill tone="">
                            {cl.classification} · {cl.observationIds.length}{" "}
                            citations
                          </Pill>
                        </div>
                      ))}
                  </div>
                ))}
                <ButtonLink href={c.href("persona", { id: p.id })} tone="">
                  Read persona
                </ButtonLink>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Choose audiences to compare."
          text="Save at least two personas, then compare their needs side by side."
        />
      )}
    </>
  );
}
function Gaps({ ctx: c }: { ctx: WorkspaceContext }) {
  const unsupported = c.data.personas.flatMap((p) =>
    personaContent
      .parse(p.revisions[0].content)
      .claims.filter(
        (cl) => cl.classification !== "finding" || !cl.observationIds.length,
      )
      .map((cl) => ({ p, cl })),
  );
  const participantCount = c.data.counts.participants;
  return (
    <>
      <PageTitle
        title="Keep the next question visible."
        description="Evidence coverage shows what’s supported and what still needs investigation."
      />
      <div className="grid g3 mb24">
        <div className="card">
          <span className="mini-count">{c.data.sources.length}</span>
          <p>research records</p>
        </div>
        <div className="card">
          <span className="mini-count">{participantCount}</span>
          <p>distinct participant references</p>
        </div>
        <div className="card">
          <span className="mini-count">{unsupported.length}</span>
          <p>claims to investigate</p>
        </div>
      </div>
      <Notice>
        Record counts are not independent participant counts. Coverage is not a
        probability that a persona is correct. Unlabelled participant records
        are excluded from the participant count.
      </Notice>
      <div className="stack mt24">
        {unsupported.length ? (
          unsupported.map(({ p, cl }) => (
            <div className="card row between" key={p.id + cl.id}>
              <div className="grow">
                <Pill tone="amber">{cl.classification}</Pill>
                <h3 className="mt16">{cl.text}</h3>
                <p className="small mt16">
                  {p.name} · Ask what evidence would support or challenge this
                  claim.
                </p>
              </div>
              <ButtonLink href={c.href("persona", { id: p.id })} tone="">
                Inspect claim
              </ButtonLink>
            </div>
          ))
        ) : (
          <Empty
            title="No unsupported claims in this view."
            text="Keep checking who is missing from the research sample and when the evidence was collected."
          />
        )}
      </div>
    </>
  );
}
function Ask({ ctx: c }: { ctx: WorkspaceContext }) {
  const [ids, setIds] = useState<string[]>([]),
    [result, setResult] = useState<{
      answer: string;
      insufficientEvidence: boolean;
      citations: { observationId: string; quote: string }[];
    } | null>(null);
  return (
    <>
      <PageTitle
        title="Ask the research, thoughtfully."
        description="Selected observations. Verifiable citations. Room for uncertainty."
      />
      <div className="split">
        <div className="card stack">
          <Pill>Evidence-bound AI</Pill>
          {!c.data.integrations.ai && (
            <Notice tone="amber">
              AI is not connected. Manual research and persona tools remain
              available.
            </Notice>
          )}
          <Form
            busy={c.busy}
            onSubmit={async (f) => {
              await c.run<typeof result>(
                {
                  action: "ai",
                  projectId: c.projectId,
                  mode: "ask",
                  question: String(f.get("question")),
                  observationIds: ids,
                },
                (r) => setResult(r),
              );
            }}
          >
            <Area
              label="What would you like to understand?"
              name="question"
              required
              maxLength={2000}
              placeholder="What do these participants need before they commit?"
            />
            <button
              className="btn primary"
              disabled={
                !ids.length ||
                !c.data.workspace.aiEnabled ||
                !c.data.integrations.ai
              }
            >
              <Icon name="spark" />
              Ask selected research
            </button>
          </Form>
          {result && (
            <div className="stack">
              <Pill tone={result.insufficientEvidence ? "amber" : "brand"}>
                {result.insufficientEvidence
                  ? "Insufficient evidence"
                  : "Cited answer"}
              </Pill>
              <p className="preserve-lines">{result.answer}</p>
              {result.citations.map((ref, i) => (
                <blockquote className="source-quote" key={i}>
                  {ref.quote}
                  <footer>{ref.observationId}</footer>
                </blockquote>
              ))}
            </div>
          )}
        </div>
        <div className="card stack">
          <h2>Select the context.</h2>
          <p className="small">
            Only selected, permitted observations are sent to the configured AI
            provider. Avoid unnecessary personal information.
          </p>
          <EvidenceSelect ctx={c} selected={ids} onChange={setIds} />
        </div>
      </div>
    </>
  );
}

function Exports({ ctx: c }: { ctx: WorkspaceContext }) {
  return (
    <>
      <PageTitle
        title="Ready to take with you."
        description="Export approved snapshots with classification, revision, and evidence references."
      />
      <Notice>
        Exports are private to the requester. Download links expire after 7
        days. Files you download or send cannot be revoked.
      </Notice>
      <div className="card mt24 stack">
        <h2>Create an export.</h2>
        <Form
          busy={c.busy}
          onSubmit={async (f) => {
            await c.run({
              action: "export.create",
              snapshotId: String(f.get("snapshotId")),
              format: f.get("format") as "pdf" | "csv",
            });
          }}
        >
          <div className="grid g2">
            <div className="field">
              <label htmlFor="snapshotId">Approved snapshot</label>
              <select id="snapshotId" name="snapshotId" required>
                {c.data.snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(s.content as unknown as PersonaContent).name} · revision{" "}
                    {s.approval.revision.number}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="format">File format</label>
              <select name="format" id="format">
                <option value="pdf">PDF document</option>
                <option value="csv">CSV spreadsheet</option>
              </select>
            </div>
          </div>
          <button
            disabled={!c.data.snapshots.length || !canEdit(c.data.role)}
            className="btn primary"
          >
            <Icon name="download" />
            Prepare export
          </button>
        </Form>
      </div>
      <div className="stack mt24">
        {c.data.exports.length ? (
          c.data.exports.map((e) => (
            <div key={e.id} className="card row between">
              <div>
                <strong>
                  {e.format.toUpperCase()} ·{" "}
                  {new Date(e.createdAt).toLocaleDateString()}
                </strong>
                <p className="small">
                  {e.failure ||
                    "Expires " + new Date(e.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <Pill tone={e.status === "failed" ? "red" : "brand"}>
                {e.status}
              </Pill>
              {e.status === "ready" ? (
                <a
                  className="btn"
                  href={`/api/v1/workspaces/${c.workspaceId}/exports/${e.id}`}
                >
                  Download <Icon name="download" />
                </a>
              ) : e.status === "failed" ? (
                <button
                  className="btn"
                  disabled={c.busy}
                  onClick={() =>
                    void c.run({ action: "export.retry", exportId: e.id })
                  }
                >
                  Retry
                </button>
              ) : (
                <button className="btn" onClick={() => void c.refresh()}>
                  Check progress
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty
            title="Your exports will be here."
            text="Publish an approved persona, then prepare a PDF or CSV."
            icon="download"
          />
        )}
      </div>
    </>
  );
}
function Team({ ctx: c }: { ctx: WorkspaceContext }) {
  const [link, setLink] = useState("");
  if (c.data.role !== "owner")
    return (
      <>
        <PageTitle title="Team & access." />
        <Notice>Only workspace owners can manage invitations and roles.</Notice>
      </>
    );
  return (
    <>
      <PageTitle
        title="A shared point of view."
        description="Owners approve and publish. Editors create. Viewers read permitted content."
      />
      <div className="split">
        <div className="stack">
          <div className="card stack">
            <h2>Workspace members</h2>
            {c.data.team.map((m) => (
              <div className="listitem" key={m.id}>
                <span className="avatar">{m.user.name.slice(0, 2)}</span>
                <div className="grow">
                  <strong>{m.user.name}</strong>
                  <p className="small">{m.user.email}</p>
                </div>
                <select
                  aria-label={"Role for " + m.user.name}
                  value={m.role}
                  disabled={c.busy}
                  onChange={(e) => {
                    if (
                      confirm(
                        `Change ${m.user.name} to ${e.target.value}? This affects editing and approval permissions.`,
                      )
                    )
                      void c.run({
                        action: "member.change",
                        memberId: m.id,
                        role: e.target.value as "owner" | "editor" | "viewer",
                      });
                  }}
                >
                  {["owner", "editor", "viewer"].map((r) => (
                    <option value={r} key={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  className="btn danger"
                  disabled={c.busy}
                  aria-label={"Remove " + m.user.name}
                  onClick={() => {
                    if (
                      confirm(
                        "Remove this member? Their next request will lose workspace access.",
                      )
                    )
                      void c.run({
                        action: "member.change",
                        memberId: m.id,
                        role: "remove",
                      });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="card stack">
            <h2>Pending invitations</h2>
            {c.data.invitations.length ? (
              c.data.invitations.map((i) => (
                <div className="listitem" key={i.id}>
                  <div className="grow">
                    <strong>{i.email}</strong>
                    <p className="small">
                      {i.role} · expires{" "}
                      {new Date(i.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    className="btn"
                    onClick={() =>
                      void c.run({
                        action: "invite.revoke",
                        invitationId: i.id,
                      })
                    }
                  >
                    Revoke
                  </button>
                </div>
              ))
            ) : (
              <p>No invitations waiting.</p>
            )}
          </div>
        </div>
        <div className="card stack">
          <h2 className="serif">Bring your team in.</h2>
          <p>
            {c.data.limits.seats} editing seats on this plan. Viewers do not use
            an editing seat.
          </p>
          <Form
            busy={c.busy}
            onSubmit={async (f) => {
              await c.run<{ url: string }>(
                {
                  action: "invite.create",
                  email: String(f.get("email")),
                  role: f.get("role") as "owner" | "editor" | "viewer",
                  projectIds: f.getAll("projectIds").map(String),
                },
                (r) => setLink(r.url),
              );
            }}
          >
            <Field label="Invite by email" name="email" type="email" required />
            <div className="field">
              <label htmlFor="role">Workspace role</label>
              <select name="role" id="role">
                <option value="viewer">Viewer · read permitted content</option>
                <option value="editor">Editor · create and submit</option>
                <option value="owner">
                  Owner · billing, approve and publish
                </option>
              </select>
            </div>
            <div className="stack sm">
              <span className="label">
                Include access to restricted projects
              </span>
              {c.data.projects.map((p) => (
                <label className="check" key={p.id}>
                  <input type="checkbox" name="projectIds" value={p.id} />
                  {p.name}
                </label>
              ))}
            </div>
            <button className="btn primary">Create invitation</button>
          </Form>
          {link && (
            <div className="stack sm">
              <Notice>
                Invitation saved and email delivery queued. This link is
                email-bound and single-use.
              </Notice>
              <Field
                label="Invitation link"
                value={link}
                readOnly
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function Settings({ ctx: c }: { ctx: WorkspaceContext }) {
  return (
    <>
      <PageTitle
        title="Your workspace, your way."
        description="Manage research processing and the space your team works in."
      />
      <div className="split">
        <div className="card stack">
          <h2>Workspace preferences</h2>
          <Form
            busy={c.busy || c.data.role !== "owner"}
            onSubmit={async (f) => {
              await c.run({
                action: "workspace.update",
                name: String(f.get("name")),
                aiEnabled: f.has("aiEnabled"),
                retentionDays: Number(f.get("retentionDays")),
              });
            }}
          >
            <Field
              label="Workspace name"
              name="name"
              defaultValue={c.data.workspace.name}
              required
            />
            <label className="check">
              <input
                type="checkbox"
                name="aiEnabled"
                defaultChecked={c.data.workspace.aiEnabled}
              />
              <span>
                Enable AI processing of selected research observations. Team
                members must review generated proposals.
              </span>
            </label>
            <Field
              label="Research review interval (days)"
              hint="Marks when research should be reviewed for relevance and retention. It does not silently delete evidence."
              name="retentionDays"
              type="number"
              min={30}
              max={3650}
              defaultValue={c.data.workspace.retentionDays}
              required
            />
            <button className="btn primary">Save preferences</button>
          </Form>
        </div>
        <aside className="stack">
          <div className="card stack sm">
            <h2>Account</h2>
            <p>{c.me.user.name}</p>
            <p>{c.me.user.email}</p>
            <ButtonLink href="/reset" tone="">
              Change password
            </ButtonLink>
            <ButtonLink href="/onboarding" tone="">
              Create another workspace
            </ButtonLink>
          </div>
          <div className="card stack sm">
            <h3>Privacy and retention</h3>
            <p>
              Use participant aliases and include only necessary information.
              Revoke shares immediately when access should end. For deletion
              that affects immutable research history, open a support request.
            </p>
            <ButtonLink href={c.href("support")} tone="">
              Request data assistance
            </ButtonLink>
          </div>
        </aside>
      </div>
    </>
  );
}
function Billing({ ctx: c }: { ctx: WorkspaceContext }) {
  const [invoices, setInvoices] = useState<
      {
        id: string;
        number: string;
        status: string;
        amount: number;
        currency: string;
        url: string;
      }[]
    >([]),
    [invoiceError, setInvoiceError] = useState("");
  useEffect(() => {
    if (c.data.role === "owner")
      api<typeof invoices>(`workspaces/${c.workspaceId}/invoices`)
        .then(setInvoices)
        .catch((e) => setInvoiceError(e.message));
  }, [c.workspaceId, c.data.role]);
  if (c.data.role !== "owner")
    return <Notice>Only workspace owners can manage billing.</Notice>;
  return (
    <>
      <PageTitle
        title="A plan that fits your work."
        description="Clear allowances, transparent checkout, and control over your subscription."
      />
      <div className="card soft row between mb24">
        <div>
          <Pill>{c.data.subscription?.plan || "Free"} workspace</Pill>
          <h2 className="mt16">{c.data.subscription?.status || "Free"}</h2>
          <p>
            {c.data.limits.seats} editing seats · {c.data.limits.personas}{" "}
            personas · {c.data.usage}/{c.data.limits.ai} AI requests used this
            month
          </p>
          {c.data.subscription?.periodEnd && (
            <p className="small">
              {c.data.subscription.cancelAtEnd
                ? "Cancellation scheduled for "
                : "Current period ends "}
              {new Date(c.data.subscription.periodEnd).toLocaleDateString()}
            </p>
          )}
        </div>
        <button
          className="btn"
          disabled={c.busy}
          onClick={() =>
            void c.run<{ url: string }>({ action: "billing.portal" }, (r) =>
              location.assign(r.url),
            )
          }
        >
          Manage subscription <Icon name="external" />
        </button>
      </div>
      {!c.data.integrations.billing && (
        <Notice tone="amber">
          Checkout is not connected yet. No payment will be taken. You can keep
          working within your free allowance.
        </Notice>
      )}
      <div className="grid g3 mt24">
        {(["starter", "team", "agency"] as const).map((key) => {
          const p = plans[key];
          return (
            <div
              className={`card stack pricing-card ${key === "team" ? "featured" : ""}`}
              key={key}
            >
              <Pill>{p.name}</Pill>
              <h2 className="serif">
                ${p.price}
                <small> / month</small>
              </h2>
              <p>{p.seats} editing seats · free viewers</p>
              {[
                `${p.projects} projects`,
                `${p.personas} saved personas`,
                `${p.ai} monthly AI requests`,
                `${p.storageMB >= 1024 ? p.storageMB / 1024 + " GB" : p.storageMB + " MB"} research storage`,
              ].map((t) => (
                <div className="row small" key={t}>
                  <Icon name="check" />
                  {t}
                </div>
              ))}
              <button
                className="btn primary"
                disabled={
                  c.busy ||
                  !c.data.integrations.billing ||
                  c.data.workspace.demo
                }
                onClick={() =>
                  void c.run<{ url: string }>(
                    { action: "checkout", plan: key },
                    (r) => location.assign(r.url),
                  )
                }
              >
                Review {p.name} checkout
              </button>
              <small>
                Final amount, taxes, and renewal terms shown in secure checkout
                before purchase.
              </small>
            </div>
          );
        })}
      </div>
      <div className="card stack mt24">
        <h2>Billing history</h2>
        {invoiceError && <Notice tone="amber">{invoiceError}</Notice>}
        {invoices.length ? (
          invoices.map((i) => (
            <div className="listitem" key={i.id}>
              <div className="grow">
                <strong>{i.number || i.id}</strong>
                <p>
                  {i.status} ·{" "}
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: i.currency,
                  }).format(i.amount / 100)}
                </p>
              </div>
              <a href={i.url} className="btn" target="_blank" rel="noreferrer">
                View invoice
              </a>
            </div>
          ))
        ) : (
          <p>No invoices yet.</p>
        )}
        <Notice>
          Cancel through subscription management. Paid access continues through
          the paid period, then a 30-day read-only export window. Contact
          support for data deletion.
        </Notice>
      </div>
    </>
  );
}
function Support({ ctx: c }: { ctx: WorkspaceContext }) {
  return (
    <>
      <PageTitle
        title="A little help, when you need it."
        description="Ask a question, report an issue, or make a data request."
      />
      <div className="split">
        <div className="card stack">
          <h2>Open a support request.</h2>
          <Form
            busy={c.busy}
            onSubmit={async (f) => {
              await c.run({
                action: "support.create",
                subject: String(f.get("subject")),
                text: String(f.get("text")),
              });
            }}
          >
            <Field label="Subject" name="subject" required maxLength={180} />
            <Area
              label="How can we help?"
              name="text"
              required
              maxLength={6000}
            />
            <p className="small">
              Research sources are not automatically attached. Include only the
              information needed to investigate.
            </p>
            <button className="btn primary">Save support request</button>
          </Form>
        </div>
        <div className="stack">
          {c.data.support.length ? (
            c.data.support.map((s) => (
              <div key={s.id} className="card stack sm">
                <div className="row between">
                  <h3>{s.subject}</h3>
                  <Pill>{s.status}</Pill>
                </div>
                <p className="preserve-lines">{s.text}</p>
                {Array.isArray(s.replies) &&
                  s.replies.map((r, i) => {
                    const reply = r as { text: string; author: string };
                    return (
                      <blockquote className="source-quote" key={i}>
                        <strong>{reply.author}</strong>
                        <p>{reply.text}</p>
                      </blockquote>
                    );
                  })}
                <small>{new Date(s.createdAt).toLocaleString()}</small>
              </div>
            ))
          ) : (
            <Empty
              title="We’re here when you need us."
              text="Your saved requests and team replies will appear here."
              icon="help"
            />
          )}
        </div>
      </div>
    </>
  );
}
function Notifications({ ctx: c }: { ctx: WorkspaceContext }) {
  return (
    <>
      <PageTitle
        title="Your team’s latest."
        description="Reviews, publishing, and support updates in one place."
      />
      <div className="stack">
        {c.data.notifications.length ? (
          c.data.notifications.map((n) => (
            <div className="card row between" key={n.id}>
              <div className="grow">
                <Pill tone={n.readAt ? "" : "brand"}>
                  {n.readAt ? "Read" : "New"}
                </Pill>
                <h3 className="mt16">{n.title}</h3>
                <p className="mt16">{n.text}</p>
                <small>{new Date(n.createdAt).toLocaleString()}</small>
              </div>
              {n.href && (
                <ButtonLink
                  href={
                    n.href +
                    (n.href.includes("?") ? "&" : "?") +
                    "workspace=" +
                    c.workspaceId
                  }
                  tone=""
                >
                  Open
                </ButtonLink>
              )}
              {!n.readAt && (
                <button
                  className="btn"
                  onClick={() =>
                    void c.run({
                      action: "notification.read",
                      notificationId: n.id,
                    })
                  }
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty
            title="You’re all caught up."
            text="Updates will appear when your team has something to share."
            icon="bell"
          />
        )}
      </div>
    </>
  );
}
