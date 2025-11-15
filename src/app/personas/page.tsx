import Image from "next/image";
import Link from "next/link";
import { personas, type Persona } from "../../data/personas";

type StageKey = keyof Persona["funnelStageEmphasis"];

const STAGE_META: Record<StageKey, { label: string; color: string }> = {
  awareness: { label: "Top-of-funnel", color: "bg-emerald-100 text-emerald-700" },
  consideration: { label: "Consideration", color: "bg-blue-100 text-blue-700" },
  conversion: { label: "Conversion", color: "bg-amber-100 text-amber-700" },
  loyalty: { label: "Loyalty", color: "bg-purple-100 text-purple-700" },
};

function getPrimaryStageKey(persona: Persona): StageKey {
  const entries = Object.entries(persona.funnelStageEmphasis) as [StageKey, number][];
  const first = entries[0];
  if (!first) {
    return "awareness";
  }
  const rest = entries.slice(1);
  return rest.reduce<[StageKey, number]>(
    (top, current) => (current[1] > top[1] ? current : top),
    first,
  )[0];
}

export default function Page() {
  const collagePersonas = personas.slice(0, 3);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 space-y-12">
        <section className="grid gap-12 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-600 font-semibold">
              Personas
            </p>
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-semibold text-slate-900">
                User Personas
              </h1>
              <p className="text-lg text-slate-600">
                Get to know your audience. Craft strategies that connect.
              </p>
              <p className="text-base text-slate-500 max-w-xl">
                Each persona was developed in collaboration with product, marketing, and success
                teams so you can unlock tailored flows, personalized onboarding, and messaging that
                resonates at every stage of the funnel.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -left-4 top-4 h-24 w-24 rounded-3xl bg-emerald-200 opacity-70 blur-sm" />
            <div className="absolute right-0 -top-6 h-28 w-28 rounded-3xl bg-purple-200 opacity-80" />
            <div className="absolute -right-3 bottom-0 h-24 w-24 rounded-2xl bg-pink-200 opacity-70" />
            <div className="relative grid grid-cols-2 gap-4 sm:gap-6">
              {collagePersonas.map((persona, index) => (
                <div
                  key={persona.slug}
                  className={`rounded-3xl border border-white/70 bg-white/70 backdrop-blur shadow-md overflow-hidden ${
                    index === 2 ? "col-span-2" : ""
                  }`}
                >
                  <Image
                    src={persona.avatar}
                    alt={persona.name}
                    width={320}
                    height={320}
                    sizes="(min-width: 768px) 280px, 90vw"
                    className="h-48 w-full object-cover sm:h-64"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-3 text-center md:text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Explore personas
            </p>
            <div>
              <h2 className="text-3xl font-semibold text-slate-900">Pick a persona</h2>
              <p className="text-slate-600">
                Select a persona profile to see their motivations, journey, and recommended plays.
              </p>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {personas.map((persona) => (
              <Link
                key={persona.slug}
                href={`/personas/${persona.slug}`}
                className="group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 rounded-2xl"
              >
                <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/60 p-6 transition-all duration-200 hover:-translate-y-1 hover:bg-white/80 hover:shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 overflow-hidden rounded-full border border-slate-100">
                      <Image
                        src={persona.avatar}
                        alt={`${persona.name} avatar`}
                        width={64}
                        height={64}
                        sizes="64px"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{persona.name}</h3>
                      <p className="text-sm text-slate-500">{persona.role}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">{persona.headline}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {persona.personalityTags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                    <span>Primary focus</span>
                    <StagePill persona={persona} />
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StagePill({ persona }: { persona: Persona }) {
  const stageKey = getPrimaryStageKey(persona);
  const meta = STAGE_META[stageKey];

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  );
}
