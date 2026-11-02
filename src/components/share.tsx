"use client";
import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/client-api";
import { type PersonaContent, personaContent } from "@/lib/domain";
import { Logo, Pill, Notice, Field, Portrait, ButtonLink, Spinner } from "./ui";
export function SharedSnapshot({ token }: { token: string }) {
  const [content, setContent] = useState<
      (PersonaContent & { revision: number }) | null
    >(null),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(true);
  async function load(passphrase?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        content: PersonaContent & { revision: number };
      }>(
        "share/" + token,
        passphrase === undefined ? undefined : { passphrase },
      );
      personaContent.parse(result.content);
      setContent(result.content);
      setCode("");
    } catch (e) {
      setContent(null);
      setError(e instanceof Error ? e.message : "This share is unavailable.");
      setCode(e instanceof ApiError ? e.code : "unavailable");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    api<{ content: PersonaContent & { revision: number } }>("share/" + token)
      .then((r) => {
        if (active) {
          setContent(r.content);
          setCode("");
          setBusy(false);
        }
      })
      .catch((e) => {
        if (active) {
          setContent(null);
          setError(e.message);
          setCode(e instanceof ApiError ? e.code : "unavailable");
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);
  return (
    <main id="main" className="public-share stack">
      <header className="row between">
        <Logo />
        <Pill tone="">Approved snapshot</Pill>
      </header>
      {busy ? (
        <Spinner />
      ) : content ? (
        <>
          <div className="share-cover">
            <div className="share-portrait">
              <Portrait />
            </div>
            <div className="stack">
              <div className="eyebrow">Audience understanding</div>
              <Pill>{content.classification}</Pill>
              <h1 className="serif">{content.name}</h1>
              <p>{content.subtitle}</p>
              <small>
                Approved revision {content.revision} · fixed published snapshot
              </small>
            </div>
          </div>
          <div className="card">
            <p className="lead">{content.summary}</p>
          </div>
          <div className="grid g2">
            {(["goal", "behaviour", "challenge", "need"] as const).map(
              (section) => (
                <section className="card stack" key={section}>
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
                  {content.claims
                    .filter((c) => c.section === section)
                    .map((cl) => (
                      <div className="stack sm" key={cl.id}>
                        <Pill tone="">{cl.classification}</Pill>
                        <p>{cl.text}</p>
                        {cl.assumptions && (
                          <p className="small">
                            Method / assumptions: {cl.assumptions}
                          </p>
                        )}
                        {cl.observationIds.length > 0 && (
                          <small>
                            {cl.observationIds.length} supporting observations ·
                            raw research is private
                          </small>
                        )}
                      </div>
                    ))}
                </section>
              ),
            )}
          </div>
          <Notice>
            Findings apply to the supplied research sample. This snapshot may
            contain hypotheses or estimates where labelled.
          </Notice>
        </>
      ) : (
        <div className="card stack">
          <h1 className="serif">
            {code === "share_unavailable"
              ? "This chapter is closed."
              : code === "passphrase_required"
                ? "A little privacy, by design."
                : "This snapshot is protected."}
          </h1>
          <Notice tone={code === "share_unavailable" ? "amber" : "blue"}>
            {error}
          </Notice>
          {code === "passphrase_required" && (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void load(
                  String(new FormData(e.currentTarget).get("passphrase")),
                );
              }}
            >
              <Field
                label="Share passphrase"
                name="passphrase"
                type="password"
                required
                autoComplete="off"
              />
              <button className="btn primary">View approved snapshot</button>
            </form>
          )}
          {["login_required", "recipient_required"].includes(code) && (
            <ButtonLink
              href={"/login?next=" + encodeURIComponent("/share/" + token)}
            >
              Sign in to continue
            </ButtonLink>
          )}
          {code === "share_unavailable" && (
            <p>Ask the workspace owner for a new approved link.</p>
          )}
        </div>
      )}
      <footer className="row between">
        <p className="small">
          Published with Personas. Research into understanding.
        </p>
        <ButtonLink href="/" tone="">
          Explore Personas
        </ButtonLink>
      </footer>
    </main>
  );
}
