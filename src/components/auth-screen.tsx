"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/domain";
import { Logo, Field, Notice, Icon, ButtonLink, Portrait } from "./ui";
export function AuthScreen({
  mode,
}: {
  mode: "login" | "signup" | "reset" | "verify" | "invite" | "onboarding";
}) {
  const search = useSearchParams(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const token = search.get("token"),
    resetting = mode === "reset" && !!token;
  const titles = {
    login: "Welcome back.",
    signup: "A clearer picture starts here.",
    reset: resetting ? "Choose a new password." : "Let’s get you back in.",
    verify: "Check your inbox.",
    invite: "Your team saved you a seat.",
    onboarding: "Make space for your research.",
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      email = String(f.get("email") || ""),
      password = String(f.get("password") || "");
    try {
      if (mode === "login") {
        const r = await authClient.signIn.email({
          email,
          password,
          callbackURL: safeNext(search.get("next")),
        });
        if (r.error) throw Error(r.error.message);
        router.push(safeNext(search.get("next")));
        router.refresh();
      }
      if (mode === "signup") {
        const r = await authClient.signUp.email({
          email,
          password,
          name: String(f.get("name")),
          callbackURL: "/app",
        });
        if (r.error) throw Error(r.error.message);
        setMessage(
          "Account created. Open the verification link in your email to continue.",
        );
      }
      if (mode === "reset") {
        const r = resetting
          ? await authClient.resetPassword({
              newPassword: password,
              token: token!,
            })
          : await authClient.requestPasswordReset({
              email,
              redirectTo: location.origin + "/reset",
            });
        if (r.error) throw Error(r.error.message);
        setMessage(
          resetting
            ? "Password updated. You can sign in now."
            : "If this account exists, a recovery email is on its way.",
        );
      }
      if (mode === "verify") {
        const r = await authClient.sendVerificationEmail({
          email,
          callbackURL: "/app",
        });
        if (r.error) throw Error(r.error.message);
        setMessage("If verification is needed, a fresh link is on its way.");
      }
      if (mode === "onboarding" || mode === "invite") {
        const r = await fetch(
          mode === "invite"
            ? "/api/v1/invitations/accept"
            : "/api/v1/onboarding",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              mode === "invite"
                ? { token }
                : {
                    workspaceName: f.get("workspaceName"),
                    projectName: f.get("projectName"),
                  },
            ),
          },
        );
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        router.push("/app?workspace=" + data.workspaceId);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="marketing">
        <header className="auth-header">
          <Logo />
          <Link className="text-link" href="/">
            Back to home <Icon name="arrow" />
          </Link>
        </header>
      </div>
      <main id="main" className="auth">
        <aside className="auth-visual stack">
          <div className="eyebrow">Research into understanding</div>
          <h1 className="serif">
            Less guessing.
            <br />
            More understanding.
          </h1>
          <Portrait tone={2} />
          <p>
            Your research. Your personas.
            <br />A shared point of view.
          </p>
          <div className="row small">
            <Icon name="lock" /> Private by default. Shared with intention.
          </div>
        </aside>
        <div className="auth-card stack">
          <div>
            <div className="eyebrow mb16">
              {mode === "onboarding" ? "Your workspace" : "Personas"}
            </div>
            <h1 className="serif">{titles[mode]}</h1>
            <p className="mt16">
              {mode === "signup"
                ? "Create your free account. Your saved work will be here when you return."
                : mode === "invite"
                  ? "Sign in with the invitation’s email address, then accept to join the workspace."
                  : mode === "verify"
                    ? "Verify your email address to keep your workspace secure."
                    : mode === "onboarding"
                      ? "Name your workspace and first project. You can add your team and research next."
                      : "Pick up where your research left off."}
            </p>
          </div>
          <form className="stack" onSubmit={submit}>
            {mode === "signup" && (
              <Field
                label="Your name"
                name="name"
                required
                autoComplete="name"
                maxLength={100}
              />
            )}
            {["login", "signup", "verify"].includes(mode) ||
            (mode === "reset" && !resetting) ? (
              <Field
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            ) : null}
            {mode === "login" || mode === "signup" || resetting ? (
              <Field
                label={resetting ? "New password" : "Password"}
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={12}
                maxLength={128}
                hint={
                  mode !== "login" ? "Use at least 12 characters." : undefined
                }
              />
            ) : null}
            {mode === "signup" && (
              <label className="check">
                <input type="checkbox" required />
                <span>
                  I agree to the{" "}
                  <Link className="text-link" href="/terms">
                    terms
                  </Link>{" "}
                  and understand the{" "}
                  <Link className="text-link" href="/privacy">
                    privacy information
                  </Link>
                  .
                </span>
              </label>
            )}
            {mode === "onboarding" && (
              <>
                <Field
                  label="Workspace name"
                  name="workspaceName"
                  placeholder="e.g. Studio research"
                  required
                  minLength={2}
                  maxLength={100}
                />
                <Field
                  label="First project"
                  name="projectName"
                  placeholder="e.g. Product discovery"
                  required
                  minLength={2}
                  maxLength={100}
                />
                <Notice>
                  Start with an empty, private workspace. Add your own research
                  or create a clearly labelled hypothesis.
                </Notice>
              </>
            )}
            {mode === "invite" && !token && (
              <Notice tone="red">
                This invitation link is incomplete. Ask the workspace owner for
                a new link.
              </Notice>
            )}
            {error && <Notice tone="red">{error}</Notice>}
            {message && <Notice>{message}</Notice>}
            <button
              className="btn primary"
              disabled={busy || (mode === "invite" && !token)}
            >
              {busy
                ? "Please wait…"
                : {
                    login: "Sign in",
                    signup: "Create account",
                    reset: resetting ? "Update password" : "Send recovery link",
                    verify: "Resend verification",
                    invite: "Accept invitation",
                    onboarding: "Create workspace",
                  }[mode]}
              <Icon name="arrow" />
            </button>
          </form>
          {mode === "login" ? (
            <div className="row between">
              <Link className="text-link" href="/reset">
                Forgot password?
              </Link>
              <Link className="text-link" href="/verify">
                Verify email
              </Link>
            </div>
          ) : null}
          {["login", "signup", "invite"].includes(mode) && (
            <p className="small">
              {mode === "login" ? "New here?" : "Already have an account?"}{" "}
              <Link
                className="text-link"
                href={
                  mode === "login"
                    ? "/signup"
                    : mode === "invite"
                      ? "/login?next=" +
                        encodeURIComponent("/invite?token=" + token)
                      : "/login"
                }
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </Link>
            </p>
          )}
          {resetting && message && (
            <ButtonLink href="/login">Sign in</ButtonLink>
          )}
        </div>
      </main>
    </div>
  );
}
