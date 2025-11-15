"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { personas, type Persona } from "../../../data/personas";

function buildBiography(persona: Persona): string {
  const primaryGoal = persona.goals[0] ?? "";
  const primaryPain = persona.painPoints[0] ?? "";
  const primaryBehavior = persona.digitalBehavior[0] ?? "";

  if (primaryGoal && primaryPain && primaryBehavior) {
    return `${persona.name} is a ${persona.role.toLowerCase()} who aims to ${primaryGoal.toLowerCase()} while struggling with ${primaryPain.toLowerCase()}. Day to day, ${primaryBehavior.toLowerCase()}.`;
  }

  return `${persona.name} is a ${persona.role.toLowerCase()} focused on meaningful, sustainable growth.`;
}

export default function Page() {
  const params = useParams();
  const slugParam = Array.isArray(params.slug) ? params.slug[0] : (params.slug as string | undefined);

  const persona = personas.find((p) => p.slug === slugParam);

  if (!slugParam || !persona) {
    // Soft "not found" state, but still in our styling
    return (
      <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50 min-h-screen">
        <main className="max-w-5xl mx-auto px-4 py-10 md:py-16 space-y-8">
          <Link
            href="/personas"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <span className="mr-1">←</span>
            <span>Back to personas</span>
          </Link>

          <section className="rounded-3xl bg-white/80 border border-slate-100 shadow-sm p-8 text-center space-y-4">
            <h1 className="text-xl font-semibold text-slate-900">
              Persona not found
            </h1>
            <p className="text-sm text-slate-600">
              We couldn&apos;t find details for this persona. Try picking one from
              the personas overview.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const biography = buildBiography(persona);

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50 min-h-screen">
      <main className="max-w-5xl mx-auto px-4 py-10 md:py-16 space-y-8">
        {/* Back link */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/personas"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <span className="mr-1">←</span>
            <span>Back to personas</span>
          </Link>
        </div>

        {/* Header card */}
        <section className="rounded-3xl bg-white/80 border border-slate-100 shadow-sm p-6 md:p-8">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] items-center">
            {/* LEFT: photo + tags */}
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-emerald-300 to-purple-300 p-[2px] rounded-2xl inline-block">
                <div className="bg-white rounded-2xl overflow-hidden">
                  <Image
                    src={persona.avatar}
                    alt={persona.name}
                    width={420}
                    height={420}
                    className="h-64 w-full object-cover md:h-72"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {persona.personalityTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* RIGHT: name, role, snippet, quote */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
                  {persona.name}
                </h1>

                <div className="inline-flex flex-wrap items-center gap-2 text-xs md:text-sm">
                  <span className="rounded-full bg-slate-900 text-white px-3 py-1">
                    {persona.age} y.o
                  </span>
                  <span className="rounded-full bg-slate-100 text-slate-800 px-3 py-1">
                    {persona.role}
                  </span>
                </div>
              </div>

              <p className="text-sm md:text-base text-slate-700">
                {persona.headline}
              </p>

              <div className="border-l-2 border-emerald-300 pl-4 text-sm text-slate-600 italic">
                “{persona.quote}”
              </div>
            </div>
          </div>
        </section>

        {/* Body layout */}
        <section className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)]">
          {/* LEFT column */}
          <div className="space-y-4">
            {/* Biography / motivations / favourite platforms */}
            <div className="rounded-3xl bg-amber-50 border border-amber-100 px-6 py-6 space-y-6">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-amber-900">
                  BIOGRAPHY
                </h2>
                <p className="mt-2 text-sm text-amber-950/80 leading-relaxed">
                  {biography}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold tracking-wide text-amber-900">
                  MOTIVATIONS
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-amber-950/80 list-disc list-inside">
                  {persona.goals.slice(0, 4).map((goal) => (
                    <li key={goal}>{goal}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold tracking-wide text-amber-900">
                  FAVOURITE PLATFORMS
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {persona.preferredPlatforms.map((platform) => (
                    <span
                      key={platform}
                      className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-amber-900 border border-amber-200"
                    >
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT column */}
          <div className="space-y-4">
            {/* Personality / content focus */}
            <div className="rounded-3xl bg-white/80 border border-slate-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold tracking-wide text-slate-900">
                PERSONALITY FOCUS
              </h2>
              <p className="text-xs text-slate-500">
                How this persona naturally shows up and engages with your
                product and audience.
              </p>

              <div className="space-y-3">
                {persona.contentFormats.slice(0, 3).map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span>{item.label}</span>
                      <span>{item.value}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Goals + pain points */}
            <div className="rounded-3xl bg-white/80 border border-slate-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold tracking-wide text-slate-900">
                GOALS &amp; CHALLENGES
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold text-emerald-800">
                    Goals
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700 list-disc list-inside">
                    {persona.goals.map((goal) => (
                      <li key={goal}>{goal}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-rose-800">
                    Pain points
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700 list-disc list-inside">
                    {persona.painPoints.map((pain) => (
                      <li key={pain}>{pain}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Digital behaviour */}
            <div className="rounded-3xl bg-white/80 border border-slate-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold tracking-wide text-slate-900">
                DIGITAL BEHAVIOUR
              </h2>
              <div className="space-y-3">
                {persona.digitalBehavior.map((item, index) => (
                  <div key={item} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      {index < persona.digitalBehavior.length - 1 && (
                        <div className="flex-1 w-px bg-slate-200 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
