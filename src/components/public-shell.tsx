"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo, Icon, ButtonLink } from "./ui";
export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="publicnav">
        <Logo />
        <nav className="publiclinks" aria-label="Main navigation">
          {[
            ["Product", "/product"],
            ["Solutions", "/solutions"],
            ["Methodology", "/methodology"],
            ["Resources", "/resources"],
            ["Pricing", "/pricing"],
          ].map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="actions row">
          <Link className="signin text-link" href="/login">
            Sign in
          </Link>
          <ButtonLink href="/signup">Start building</ButtonLink>
          <button
            aria-label="Open navigation"
            aria-expanded={open}
            className="btn icon-only mobile-menu"
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </header>
      {open && (
        <nav className="mobile-public-nav" aria-label="Mobile navigation">
          {[
            "Product",
            "Solutions",
            "Methodology",
            "Resources",
            "Pricing",
            "About",
            "Contact",
            "Login",
          ].map((s) => (
            <Link
              onClick={() => setOpen(false)}
              href={"/" + s.toLowerCase()}
              key={s}
            >
              {s === "Login" ? "Sign in" : s}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
export function PublicFooter() {
  return (
    <footer className="marketing">
      <div className="publicfooter">
        <div className="stack sm">
          <Logo />
          <p>
            People are more than a profile.
            <br />
            Make room for the evidence.
          </p>
          <small>© {new Date().getFullYear()} Personas</small>
        </div>
        <div className="footerlinks">
          {[
            ["Product", "product", "methodology", "examples", "pricing"],
            [
              "For your team",
              "solutions/agencies",
              "solutions/product-teams",
              "solutions/marketers",
            ],
            ["Explore", "resources", "about", "contact", "privacy", "terms"],
          ].map(([title, ...paths]) => (
            <div className="stack sm" key={title}>
              <strong>{title}</strong>
              {paths.map((p) => (
                <Link key={p} href={"/" + p}>
                  {p.split("/").at(-1)?.replaceAll("-", " ")}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
