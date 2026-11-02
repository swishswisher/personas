import Link from "next/link";
import { PublicHeader, PublicFooter } from "./public-shell";
import { Logo, Icon, ButtonLink, Pill, Portrait } from "./ui";
import { ContactForm } from "./contact";
import { plans } from "@/lib/domain";
const features = [
  [
    "file",
    "Keep the context",
    "Interviews, surveys, files, and observations live together, with exact passages behind every finding.",
  ],
  [
    "spark",
    "A thoughtful AI partner",
    "Turn your selected research into a cited proposal. Inspect, edit, and decide what deserves a place.",
  ],
  [
    "people",
    "Personas that keep growing",
    "Save and refine audiences as you learn. Goals, behaviours, challenges, and needs stay connected to evidence.",
  ],
  [
    "route",
    "Move from insight to action",
    "Map audience journeys, compare needs, and write focused briefs for your next product or campaign.",
  ],
  [
    "comment",
    "Make the review count",
    "Discuss the work, compare revisions, and approve a specific version before it leaves your team.",
  ],
  [
    "share",
    "Share with intention",
    "Publish a fixed snapshot, set an expiry or passphrase, revoke access, and export approved work.",
  ],
] as const;
const articles = [
  [
    "evidence",
    "What makes a persona evidence-backed?",
    "A practical guide to claims, source passages, and honest uncertainty.",
  ],
  [
    "interviews",
    "Ask better research questions",
    "Start with a decision, invite specific stories, and keep your assumptions visible.",
  ],
  [
    "living-personas",
    "Keep personas useful over time",
    "Treat audience knowledge as a living practice with regular evidence reviews.",
  ],
];
export const publicPaths = [
  "product",
  "solutions",
  "solutions/agencies",
  "solutions/product-teams",
  "solutions/marketers",
  "methodology",
  "examples",
  "resources",
  "resources/evidence",
  "resources/interviews",
  "resources/living-personas",
  "pricing",
  "about",
  "contact",
  "privacy",
  "terms",
];
const titles: Record<string, string> = {
  product: "A home for your audience knowledge.",
  solutions: "Good research belongs in every team.",
  methodology: "Show your working. Build trust.",
  examples: "A little inspiration. Clearly fictional.",
  resources: "Make space for better questions.",
  pricing: "Start small. Grow with your team.",
  about: "Understanding people is a team sport.",
  contact: "Let’s build a clearer picture.",
  privacy: "Your research deserves care.",
  terms: "A clear agreement for working together.",
};
function FeatureGrid() {
  return (
    <div className="grid g3">
      {features.map(([icon, title, text]) => (
        <article className="card stack sm" key={title}>
          <div className="iconbox">
            <Icon name={icon} />
          </div>
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}
function Cta() {
  return (
    <section className="brand-band row between">
      <div>
        <div className="eyebrow mb16">A clearer picture starts here</div>
        <h2 className="serif">
          Bring your audience
          <br />
          into the conversation.
        </h2>
      </div>
      <div className="stack sm">
        <ButtonLink href="/signup" tone="apricot" icon="arrow">
          Create your first persona
        </ButtonLink>
        <p>No card required for the free workspace.</p>
      </div>
    </section>
  );
}
function Example({ small = false }: { small?: boolean }) {
  return (
    <div className={small ? "mockup" : "card persona-example"}>
      <div className="mock-head row between">
        <Logo />
        <Pill tone="amber">Fictional example</Pill>
      </div>
      <div className="mock-main">
        <Portrait />
        <div className="stack sm">
          <div className="eyebrow">Audience pattern</div>
          <h3 className="serif">
            The deliberate
            <br />
            buyer
          </h3>
          <p>Clarity before commitment.</p>
          <div className="rule" />
          <strong className="small">What matters</strong>
          <p className="small">
            Understand the full cost. Make a clear case. Bring the team along.
          </p>
          <Pill>Hypothesis to validate</Pill>
        </div>
      </div>
    </div>
  );
}
export function PublicPage({
  path = "",
  content,
}: {
  path?: string;
  content?: { title: string; body: string } | null;
}) {
  const isHome = !path,
    solution = path.startsWith("solutions/"),
    article = path.startsWith("resources/");
  const audience = path.endsWith("agencies")
    ? "agencies"
    : path.endsWith("marketers")
      ? "marketers"
      : "product teams";
  const title =
    content?.title ||
    (solution
      ? `A shared understanding, built for ${audience}.`
      : article
        ? articles.find((a) => path.endsWith(a[0]))?.[1]
        : titles[path]) ||
    "Personas";
  return (
    <>
      <PublicHeader />
      <main id="main" className="marketing">
        {isHome ? (
          <>
            <section className="hero">
              <div>
                <div className="eyebrow">Research into understanding</div>
                <h1>
                  Know the people.
                  <br />
                  <span className="serif">Build what matters.</span>
                </h1>
                <p className="lead">
                  Bring your research together. Build personas with evidence
                  behind them. Give your whole team a clearer picture of who
                  they’re creating for.
                </p>
                <div className="row">
                  <ButtonLink href="/signup" icon="arrow">
                    Build your first persona
                  </ButtonLink>
                  <ButtonLink href="/examples" tone="">
                    Explore an example
                  </ButtonLink>
                </div>
                <p className="small mt16">
                  Start free · Save your work · Let the evidence lead
                </p>
              </div>
              <div className="hero-art">
                <div className="hero-orbit" />
                <div className="hero-orbit o2" />
                <Example small />
                <div className="floating-evidence">
                  <div className="row mb8">
                    <Icon name="file" />
                    <strong className="small">
                      Every insight has a starting point.
                    </strong>
                  </div>
                  <p className="small">
                    From a source passage to a clearer decision.
                  </p>
                </div>
              </div>
            </section>
            <div className="proofstrip">
              <span className="caption">Made for thoughtful teams</span>
              {[
                "Product & design",
                "Marketing & strategy",
                "Agencies & studios",
              ].map((t) => (
                <span key={t}>
                  <Icon name="check" /> {t}
                </span>
              ))}
            </div>
            <section className="section">
              <div className="section-head">
                <h2 className="serif">
                  More than a profile.
                  <br />A shared understanding.
                </h2>
                <p>
                  Less scattered context. More useful audience knowledge, from
                  the first interview to the next decision.
                </p>
              </div>
              <FeatureGrid />
            </section>
            <section className="section editorial-grid">
              <div>
                <div className="eyebrow mb16">From the source to the story</div>
                <h2 className="serif">
                  A clear path from
                  <br />
                  research to ready.
                </h2>
                <p className="mt24">
                  Capture what people say. Make sense of the patterns. Review
                  the story together, then share what your team can stand
                  behind.
                </p>
                <ButtonLink href="/methodology" tone="ghost" icon="arrow">
                  Our approach to evidence
                </ButtonLink>
              </div>
              <div className="stack">
                {[
                  [
                    "01",
                    "Capture the context",
                    "Upload sources or record interviews and surveys.",
                  ],
                  [
                    "02",
                    "Create with care",
                    "Build manually or let AI propose a cited draft.",
                  ],
                  [
                    "03",
                    "Review, approve, publish",
                    "Keep history and share a deliberate snapshot.",
                  ],
                ].map(([n, h, p]) => (
                  <div className="card row" key={n}>
                    <span className="stepnum">{n}</span>
                    <div>
                      <h3>{h}</h3>
                      <p className="mt16">{p}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <Cta />
          </>
        ) : (
          <>
            <section className="pagehero">
              <div className="eyebrow mb16">
                {solution
                  ? "For " + audience
                  : article
                    ? "Field notes"
                    : path.replaceAll("/", " / ")}
              </div>
              <h1 className="serif">{title}</h1>
              <p>
                {(
                  {
                    product:
                      "Your research library, persona workshop, and team review room. One connected place to turn what you learn into what you do.",
                    methodology:
                      "Evidence does not remove uncertainty. It makes the basis for a decision visible.",
                    solutions:
                      "Different work. Shared questions. One place to understand the people you serve.",
                    examples:
                      "Explore how a persona can describe needs and behaviours. These examples are invented and are not customer analytics.",
                    pricing:
                      "Choose the space your research needs. Citations, honest labels, and secure permissions belong in every plan.",
                    resources:
                      "Practical notes for useful research and audience knowledge.",
                    about:
                      "We’re building a more thoughtful way to work with audience knowledge.",
                  } as Record<string, string>
                )[path] || "Build useful audience knowledge, together."}
              </p>
            </section>
            {content ? (
              <article className="card prose-content">
                {content.body.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </article>
            ) : path === "product" ? (
              <>
                <section className="section">
                  <FeatureGrid />
                </section>
                <section className="section split">
                  <Example />
                  <div className="card dark stack">
                    <h2 className="serif">AI that shows its sources.</h2>
                    <p>
                      Choose the observations you want to use. Ask a research
                      question or request a persona proposal. Every finding
                      needs support, and missing evidence stays visible.
                    </p>
                    <p>
                      You control AI processing for each workspace. AI drafts
                      are proposals for human review.
                    </p>
                    <ButtonLink href="/methodology" tone="apricot">
                      See the evidence standard
                    </ButtonLink>
                  </div>
                </section>
              </>
            ) : path === "solutions" || solution ? (
              <section className="section">
                <div className="grid g3">
                  {[
                    [
                      "agencies",
                      "Keep client work in context.",
                      "Separate projects, restricted access, client viewers, and polished deliverables.",
                    ],
                    [
                      "product-teams",
                      "Make decisions with people in mind.",
                      "Link audience needs to research, journeys, and product briefs.",
                    ],
                    [
                      "marketers",
                      "Build a message around real needs.",
                      "Compare audience patterns and preserve the source of every finding.",
                    ],
                  ].map(([s, h, p]) => (
                    <article className="card stack" key={s}>
                      <div className="iconbox">
                        <Icon name="people" />
                      </div>
                      <h2 className="serif">{h}</h2>
                      <p>{p}</p>
                      <ButtonLink
                        href={solution ? "/signup" : "/solutions/" + s}
                        tone=""
                        icon="arrow"
                      >
                        {solution
                          ? "Create a workspace"
                          : "Explore " + s.replaceAll("-", " ")}
                      </ButtonLink>
                    </article>
                  ))}
                </div>
                <div className="card soft mt24">
                  <h2>Designed for the work around a persona.</h2>
                  <p className="mt16">
                    Research capture, collaboration, approvals, comparisons,
                    evidence gaps, journeys, and revocable sharing all work
                    together.
                  </p>
                </div>
              </section>
            ) : path === "methodology" ? (
              <section className="section stack">
                <div className="grid g2">
                  {[
                    [
                      "Research finding",
                      "A scoped observation supported by an exact passage from a research source.",
                    ],
                    [
                      "Estimate",
                      "A reasoned calculation with its assumptions, method, and sample context.",
                    ],
                    [
                      "Hypothesis",
                      "An idea to investigate, clearly separated from validated research.",
                    ],
                    [
                      "Fictional example",
                      "Invented material used to explain or demonstrate. It is never presented as real research.",
                    ],
                  ].map(([h, p]) => (
                    <div className="card stack sm" key={h}>
                      <Pill>{h}</Pill>
                      <h2 className="serif">{h}</h2>
                      <p>{p}</p>
                    </div>
                  ))}
                </div>
                <div className="card stack">
                  <h2>Keep the original context close.</h2>
                  <p>
                    Link claims to observations and observations to exact source
                    passages. Use a consistent participant reference to
                    distinguish independent people from repeated records. Source
                    counts show coverage, never a probability that a persona is
                    correct.
                  </p>
                  <h3>Review the version you mean to publish.</h3>
                  <p>
                    Approval belongs to a specific revision. Later draft changes
                    create new history and need a new review. Published
                    snapshots stay fixed until deliberately replaced or revoked.
                  </p>
                </div>
              </section>
            ) : path === "examples" ? (
              <section className="section split">
                <Example />
                <div className="stack">
                  <Pill tone="amber">Fictional · no research measurements</Pill>
                  <h2 className="serif">The deliberate buyer</h2>
                  <p>
                    A sample persona for discussing people who want clarity
                    before committing to a team tool.
                  </p>
                  {[
                    ["Goal", "Understand total cost before committing."],
                    [
                      "Behaviour",
                      "Brings a decision-maker into the evaluation.",
                    ],
                    ["Challenge", "Unclear limits create uncertainty."],
                    [
                      "Research question",
                      "What information do buyers need before inviting their team?",
                    ],
                  ].map(([a, b]) => (
                    <div className="card" key={a}>
                      <div className="eyebrow mb8">{a}</div>
                      <p>{b}</p>
                    </div>
                  ))}
                  <ButtonLink href="/signup">Build your own persona</ButtonLink>
                </div>
              </section>
            ) : path === "pricing" ? (
              <section className="section">
                <div className="grid g3">
                  {Object.entries(plans)
                    .filter(([key]) => key !== "free")
                    .map(([key, p]) => (
                      <article
                        key={key}
                        className={`card pricing-card stack ${key === "team" ? "featured" : ""}`}
                      >
                        <Pill>{p.name}</Pill>
                        <h2 className="serif">
                          ${p.price}
                          <small> / month</small>
                        </h2>
                        <p>
                          {p.seats} editing {p.seats === 1 ? "seat" : "seats"} ·
                          unlimited read-only viewers
                        </p>
                        <div className="rule" />
                        {[
                          `${p.projects} projects`,
                          `${p.personas} saved personas`,
                          `${p.ai} AI requests per month`,
                          `${p.storageMB / 1024} GB research storage`,
                          "Evidence links and revision history",
                          "Approval, sharing, PDF and CSV",
                        ].map((t) => (
                          <div className="row small" key={t}>
                            <Icon name="check" />
                            {t}
                          </div>
                        ))}
                        <ButtonLink href={"/signup?plan=" + key}>
                          Start with {p.name}
                        </ButtonLink>
                        <small>
                          Taxes calculated at checkout. AI requires workspace
                          consent.
                        </small>
                      </article>
                    ))}
                </div>
                <div className="card soft mt24 row between">
                  <div>
                    <h3>Make your first useful persona for free.</h3>
                    <p>
                      1 editing seat · 2 projects · 5 personas · core evidence
                      and publishing tools.
                    </p>
                  </div>
                  <ButtonLink href="/signup" tone="">
                    Create a free workspace
                  </ButtonLink>
                </div>
                <div className="stack mt24">
                  {[
                    [
                      "Can I cancel?",
                      "Yes. Manage cancellation in the billing portal. Paid access continues through the paid period, followed by a read-only export window.",
                    ],
                    [
                      "Is AI required?",
                      "No. Manual authoring, research, evidence links, and team review work without AI.",
                    ],
                    [
                      "What happens to my research?",
                      "Your workspace data is private. Restricted projects limit access within the workspace. Public shares contain approved persona content, not raw research.",
                    ],
                  ].map(([q, a]) => (
                    <details className="card" key={q}>
                      <summary>{q}</summary>
                      <p className="mt16">{a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : path === "resources" ? (
              <section className="section grid g3">
                {articles.map(([slug, h, p], i) => (
                  <Link
                    className="card click stack"
                    href={"/resources/" + slug}
                    key={slug}
                  >
                    <div className="resource-art">
                      <span>0{i + 1}</span>
                      <Icon name="book" />
                    </div>
                    <Pill>Field notes</Pill>
                    <h2 className="serif">{h}</h2>
                    <p>{p}</p>
                    <span className="text-link">
                      Read the note <Icon name="arrow" />
                    </span>
                  </Link>
                ))}
              </section>
            ) : article ? (
              <Article path={path} />
            ) : path === "about" ? (
              <section className="section editorial-grid">
                <h2 className="serif">A persona should open a conversation.</h2>
                <div className="stack">
                  <p>
                    Audience profiles are useful when they help a team ask
                    better questions. They become a problem when a polished
                    story hides where it came from.
                  </p>
                  <p>
                    Personas connects research, human judgment, and everyday
                    decisions. It gives teams a place to save what they learn,
                    examine the evidence, and make useful work together.
                  </p>
                  <h3>Our product principles</h3>
                  <p>
                    Keep the context. Name uncertainty. Make collaboration
                    clear. Preserve trust when insights are shared.
                  </p>
                  <ButtonLink href="/contact" tone="">
                    Talk to us
                  </ButtonLink>
                </div>
              </section>
            ) : path === "contact" ? (
              <section className="section split">
                <div className="stack">
                  <h2 className="serif">Tell us about your team.</h2>
                  <p>
                    Have a product question, an agency workflow to discuss, or a
                    request about your data? Send a note here. Existing
                    customers can also use workspace support.
                  </p>
                  <div className="card soft">
                    <Icon name="lock" />
                    <p className="mt16">
                      Please leave participant information and sensitive
                      research out of this form.
                    </p>
                  </div>
                </div>
                <ContactForm />
              </section>
            ) : (
              <Legal path={path} />
            )}
            {!["contact", "privacy", "terms"].includes(path) && <Cta />}
          </>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
function Article({ path }: { path: string }) {
  const isEvidence = path.endsWith("evidence");
  return (
    <article className="section prose-content stack">
      <h2 className="serif">
        {isEvidence
          ? "Start with a claim you can inspect."
          : path.endsWith("interviews")
            ? "Listen for a specific story."
            : "Revisit what your team believes."}
      </h2>
      <p>
        {isEvidence
          ? "A useful persona describes needs and behaviours with a visible basis. Write one clear claim, link the exact source passage, and explain the limits of the sample."
          : "Begin with the decision your team needs to make. Ask what evidence would change your mind, then collect stories and observations that help answer that question."}
      </p>
      <h3>Separate what you know from what you think.</h3>
      <p>
        Use finding, estimate, hypothesis, and fictional labels consistently. An
        attractive profile or an AI draft does not turn an assumption into a
        research finding.
      </p>
      <h3>Count people carefully.</h3>
      <p>
        Three records from one participant are still one participant. Keep
        participant references consistent and explain what your sample can and
        cannot support.
      </p>
      <h3>Keep the next question visible.</h3>
      <p>
        Unsupported claims are opportunities for research. Add a question,
        identify who is missing, and decide what you need to learn before
        acting.
      </p>
      <ButtonLink href="/methodology" tone="">
        Read our methodology
      </ButtonLink>
    </article>
  );
}
function Legal({ path }: { path: string }) {
  return (
    <article className="section prose-content stack">
      {(path === "privacy"
        ? [
            [
              "What we store",
              "Account details, workspace membership, research you provide, persona revisions, collaboration records, support messages, and necessary security and billing metadata. Payment card details are handled by the payment provider.",
            ],
            [
              "How your research is used",
              "We process your content to provide the workspace features you request. AI processing is controlled by the workspace owner and requires an enabled provider. Selected observations are sent only when a team member requests assistance.",
            ],
            [
              "Access and sharing",
              "Workspace and project permissions govern private content. Approved snapshots are accessible under the share controls you choose. Avoid including unnecessary participant identities in personas. Downloaded exports cannot be recalled.",
            ],
            [
              "Retention and requests",
              "Owners can remove uncited sources and revoke shares. For source redaction, account data requests, or deletion affecting research history, contact support. Backup retention can delay physical removal of deleted data. Your workspace retention setting guides scheduled research review.",
            ],
            [
              "Providers and security",
              "Hosting and PostgreSQL infrastructure, private object storage, transactional email, AI processing when enabled, and payment processing may use service providers. Configure their regions, retention, and data processing terms before using sensitive research.",
            ],
          ]
        : [
            [
              "Using Personas",
              "Use the service for lawful research and collaboration. You are responsible for consent, permissions, and the accuracy of content you upload or share. Do not upload material you are not authorized to process.",
            ],
            [
              "Your content",
              "You retain rights to your research and persona content. You grant the service permission to process it to deliver requested features. Workspace owners control team access, approved publication, and subscriptions.",
            ],
            [
              "AI and research judgment",
              "AI assistance produces proposals for review. You remain responsible for verifying citations, respecting research participants, and deciding whether a claim is adequately supported.",
            ],
            [
              "Subscriptions and cancellation",
              "Plan limits and recurring amounts are shown before checkout. The payment provider calculates applicable taxes. Cancellation through billing management takes effect at the end of the paid period, followed by a 30-day read-only export window.",
            ],
            [
              "Service and support",
              "Contact support about access, billing, research privacy, or technical issues. Service availability and integration capabilities depend on operational configuration.",
            ],
          ]
      ).map(([h, p]) => (
        <section className="stack sm" key={h}>
          <h2>{h}</h2>
          <p>{p}</p>
        </section>
      ))}
      <ButtonLink href="/contact" tone="">
        Contact Personas
      </ButtonLink>
    </article>
  );
}
