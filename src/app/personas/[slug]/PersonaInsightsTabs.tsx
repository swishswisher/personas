"use client";

import { useState } from "react";
import type { Persona } from "../../../data/personas";

type TabKey = "goals" | "painPoints" | "digitalBehavior" | "opportunities";

const tabs: { id: TabKey; label: string }[] = [
  { id: "goals", label: "Goals" },
  { id: "painPoints", label: "Pain points" },
  { id: "digitalBehavior", label: "Digital behavior" },
  { id: "opportunities", label: "Opportunities" },
];

export default function PersonaInsightsTabs({ persona }: { persona: Persona }) {
  const [activeTab, setActiveTab] = useState<TabKey>("goals");

  const opportunities = persona.goals.length
    ? persona.goals.map((goal, index) => {
        const painPoint = persona.painPoints[index % persona.painPoints.length];
        const subject = persona.name.split(" ")[0];
        return painPoint
          ? `Support ${subject} in achieving ${goal.toLowerCase()} while reducing ${painPoint.toLowerCase()}.`
          : `Create a play that helps ${subject} ${goal.toLowerCase()}.`;
      })
    : ["Identify additional insights to unlock opportunities."];

  const tabEntries: Record<Exclude<TabKey, "opportunities">, string[]> = {
    goals: persona.goals,
    painPoints: persona.painPoints,
    digitalBehavior: persona.digitalBehavior,
  };

  const currentItems = activeTab === "opportunities" ? opportunities : tabEntries[activeTab] || [];

  return (
    <div className="space-y-8">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "bg-black text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white/80 p-5">
        {currentItems.length ? (
          <ul className="list-disc space-y-3 pl-5 text-slate-600 transition-opacity duration-200">
            {currentItems.map((item, index) => (
              <li key={`${activeTab}-${index}`} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm transition-opacity duration-200">
            Data for this tab hasn&apos;t been added yet.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {(Object.entries(persona.funnelStageEmphasis) as [keyof Persona["funnelStageEmphasis"], number][]).map(
          ([stage, value]) => (
            <div key={stage} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span className="capitalize">{stage}</span>
                <span>{value}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
