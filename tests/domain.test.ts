import { describe, it, expect } from "vitest";
import {
  validateEvidence,
  personaContent,
  csvCell,
  snapshotCsv,
  safeNext,
} from "../src/lib/domain";
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
