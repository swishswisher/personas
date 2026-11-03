import { Logo, ButtonLink } from "@/components/ui";
export default function NotFound() {
  return (
    <main tabIndex={-1} id="main" className="not-found stack">
      <Logo />
      <div className="eyebrow">404 · A missing piece</div>
      <h1 className="serif">This page isn’t here.</h1>
      <p>The link may have changed. Your audience work is in your workspace.</p>
      <div className="row">
        <ButtonLink href="/app">Open workspace</ButtonLink>
        <ButtonLink href="/" tone="">
          Back to home
        </ButtonLink>
      </div>
    </main>
  );
}
