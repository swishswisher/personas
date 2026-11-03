import "dotenv/config";
import { db } from "../src/server/db";
import { savePersona } from "../src/server/personas";
const email = process.env.DEMO_OWNER_EMAIL;
if (!email)
  throw new Error(
    "Set DEMO_OWNER_EMAIL to an existing verified user. No customer data will be modified.",
  );
const user = await db.user.findUnique({ where: { email } });
if (!user?.emailVerified)
  throw new Error("The demo owner must already have a verified account.");
const existing = await db.workspace.findFirst({
  where: {
    demo: true,
    name: "Personas · Fictional demonstration",
    memberships: { some: { userId: user.id, role: "owner" } },
  },
});
if (existing) {
  console.log("Demonstration already exists:", existing.id);
  await db.$disconnect();
  process.exit(0);
}
const ws = await db.workspace.create({
  data: {
    name: "Personas · Fictional demonstration",
    demo: true,
    memberships: { create: { userId: user.id, role: "owner" } },
    subscription: { create: {} },
  },
});
const project = await db.project.create({
  data: { workspaceId: ws.id, name: "Fictional product discovery" },
});
const source = await db.researchSource.create({
  data: {
    workspaceId: ws.id,
    projectId: project.id,
    title: "Fictional interview · P01",
    kind: "interview",
    participant: "P01",
    classification: "fictional",
    tags: ["demonstration"],
    text: "I want to understand the full cost before I bring my team into another tool.",
  },
});
const observation = await db.observation.create({
  data: {
    workspaceId: ws.id,
    projectId: project.id,
    sourceId: source.id,
    quote: source.text,
    start: 0,
    end: source.text.length,
    insight: "Fictional example of a need for clear pricing.",
    classification: "fictional",
    tags: ["pricing"],
  },
});
await savePersona(user, ws.id, {
  projectId: project.id,
  content: {
    name: "The deliberate buyer",
    subtitle: "Fictional · clarity before commitment",
    summary:
      "A fictional audience example for learning the Personas workflow. This is not customer research.",
    classification: "fictional",
    claims: [
      {
        id: crypto.randomUUID(),
        section: "goal",
        text: "Understand the full cost before committing.",
        classification: "fictional",
        observationIds: [observation.id],
        assumptions: "",
      },
      {
        id: crypto.randomUUID(),
        section: "challenge",
        text: "Unclear limits make evaluation harder.",
        classification: "hypothesis",
        observationIds: [],
        assumptions: "",
      },
    ],
  },
  note: "Labelled fictional demonstration seed",
});
console.log("Created isolated fictional demonstration workspace:", ws.id);
await db.$disconnect();
