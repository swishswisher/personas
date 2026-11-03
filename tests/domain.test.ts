import { describe, it, expect } from "vitest";
import {
  validateEvidence,
  personaContent,
  csvCell,
  snapshotCsv,
  safeNext,
  plans,
} from "../src/lib/domain";
import { validateCheckoutPrice } from "../src/server/subscriptions";
import { hashPassphrase, checkPassphrase } from "../src/server/security";
import { verifyCitations } from "../src/server/ai";
const content = personaContent.parse({
  name: "Deliberate buyer",
  summary: "An audience hypothesis.",
  classification: "hypothesis",
  claims: [
    {
      id: "goal1",
      section: "goal",
      text: "Understand total cost",
      classification: "hypothesis",
      observationIds: [],
    },
  ],
});
describe("evidence contract", () => {
  it("allows an honestly labelled hypothesis without evidence", () =>
    expect(() => validateEvidence(content, [])).not.toThrow());
  it("rejects findings without support", () =>
    expect(() =>
      validateEvidence(
        {
          ...content,
          claims: [{ ...content.claims[0], classification: "finding" }],
        },
        [],
      ),
    ).toThrow("supporting"));
  it("rejects a citation from another scope", () =>
    expect(() =>
      validateEvidence(
        {
          ...content,
          claims: [{ ...content.claims[0], observationIds: ["foreign"] }],
        },
        [],
      ),
    ).toThrow("unavailable"));
  it("requires methods for estimates", () =>
    expect(() =>
      validateEvidence(
        {
          ...content,
          claims: [{ ...content.claims[0], classification: "estimate" }],
        },
        [],
      ),
    ).toThrow("assumptions"));
  it("rejects fictional support for a finding", () =>
    expect(() =>
      validateEvidence(
        {
          ...content,
          claims: [
            {
              ...content.claims[0],
              classification: "finding",
              observationIds: ["o1"],
            },
          ],
        },
        [{ id: "o1", classification: "fictional" }],
      ),
    ).toThrow("supporting"));
  it("verifies the exact text and identifier of AI citations", () => {
    expect(() =>
      verifyCitations(
        {
          answer: "Cost matters",
          insufficientEvidence: false,
          citations: [{ observationId: "o1", quote: "invented" }],
        },
        [{ id: "o1", quote: "Full cost matters." }],
      ),
    ).toThrow("unverifiable");
    expect(
      verifyCitations(
        {
          answer: "Cost matters",
          insufficientEvidence: false,
          citations: [{ observationId: "o1", quote: "Full cost" }],
        },
        [{ id: "o1", quote: "Full cost matters." }],
      ).citations,
    ).toHaveLength(1);
  });
  it("does not allow an uncited confident AI answer", () =>
    expect(() =>
      verifyCitations(
        { answer: "Certain", insufficientEvidence: false, citations: [] },
        [],
      ),
    ).toThrow("did not cite"));
});
describe("safe publishing output", () => {
  it("neutralizes spreadsheet formulas and escapes quotes", () => {
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
    expect(csvCell('A "quote"')).toBe('"A ""quote"""');
  });
  it("includes classification and revision in CSV", () => {
    const csv = snapshotCsv(content, 3);
    expect(csv).toContain('"3","hypothesis"');
    expect(csv).toContain("Understand total cost");
  });
  it("hashes passphrases with salts and rejects the wrong value", () => {
    const a = hashPassphrase("private-passphrase"),
      b = hashPassphrase("private-passphrase");
    expect(a).not.toBe(b);
    expect(checkPassphrase("private-passphrase", a)).toBe(true);
    expect(checkPassphrase("wrong", a)).toBe(false);
  });
  it("only accepts local post-login navigation", () => {
    expect(safeNext("//evil.example")).toBe("/app");
    expect(safeNext("/app/personas")).toBe("/app/personas");
    expect(safeNext("/\\evil")).toBe("/app");
  });
});
describe("affordable pricing and checkout consistency", () => {
  const price = {
    active: true,
    currency: "usd",
    unit_amount: 500,
    type: "recurring",
    recurring: {
      interval: "month",
      interval_count: 1,
      usage_type: "licensed",
      trial_period_days: null,
      meter: null,
    },
  } as const;
  it("accepts the approved monthly amounts and rejects stale Stripe prices", () => {
    expect([
      plans.free.price,
      plans.starter.price,
      plans.team.price,
      plans.agency.price,
    ]).toEqual([0, 5, 15, 39]);
    for (const plan of ["starter", "team", "agency"] as const)
      expect(() =>
        validateCheckoutPrice(plan, {
          ...price,
          unit_amount: plans[plan].price * 100,
        }),
      ).not.toThrow();
    expect(() =>
      validateCheckoutPrice("starter", { ...price, unit_amount: 1900 }),
    ).toThrow("No payment");
  });
  it("rejects annual, inactive, foreign-currency or metered prices", () => {
    for (const input of [
      { ...price, active: false },
      { ...price, currency: "eur" },
      { ...price, recurring: { ...price.recurring, interval_count: 12 } },
      {
        ...price,
        recurring: { ...price.recurring, usage_type: "metered" as const },
      },
    ])
      expect(() => validateCheckoutPrice("starter", input)).toThrow(
        "billing price",
      );
  });
});
