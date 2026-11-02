"use client";
import type { ReactNode } from "react";
import type { WorkspaceContext } from "./workspace";
export function Form({
  children,
  onSubmit,
  busy = false,
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => void | Promise<void>;
  busy?: boolean;
}) {
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(new FormData(e.currentTarget));
      }}
    >
      <fieldset className="form-fieldset stack" disabled={busy}>
        {children}
      </fieldset>
    </form>
  );
}
export function EvidenceSelect({
  ctx: c,
  selected,
  onChange,
}: {
  ctx: WorkspaceContext;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="stack sm">
      {c.data.observations.length ? (
        c.data.observations.map((o) => (
          <label className="checkcard" key={o.id}>
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, o.id]
                    : selected.filter((id) => id !== o.id),
                )
              }
            />
            <span>
              <strong>{o.insight}</strong>
              <span className="evidence-quote">“{o.quote}”</span>
              <small>
                {o.source.title} · {o.classification}
              </small>
            </span>
          </label>
        ))
      ) : (
        <p className="small">
          Capture observations from a research source to use them as evidence.
        </p>
      )}
    </div>
  );
}
export function PageControls({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total <= 100) return null;
  return (
    <nav className="row between mt24" aria-label="Library pages">
      <button
        className="btn"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous page
      </button>
      <span className="small muted">
        Page {page} of {Math.ceil(total / 100)} · {total} records
      </span>
      <button
        className="btn"
        disabled={page * 100 >= total}
        onClick={() => onPage(page + 1)}
      >
        Next page
      </button>
    </nav>
  );
}
