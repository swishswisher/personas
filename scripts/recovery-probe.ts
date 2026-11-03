import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { db } from "../src/server/db";
import {
  workspaceData,
  sourceDetail,
  personaHistory,
} from "../src/server/queries";
import { readShare } from "../src/server/publishing";
import { getFile } from "../src/server/storage";
import { Prisma } from "../src/generated/prisma/client";
const fixture = JSON.parse(await readFile(process.argv[2], "utf8"));
try {
  await assert.rejects(
    workspaceData(
      { ...fixture.owner, id: "recovery-outsider" },
      fixture.workspaceId,
    ),
    { status: 404 },
  );
  const data = await workspaceData(
    fixture.owner,
    fixture.workspaceId,
    fixture.projectId,
  );
  assert.equal(data.counts.personas, 1);
  assert.equal(
    (await sourceDetail(fixture.owner, fixture.workspaceId, fixture.sourceId))
      .text,
    fixture.text,
  );
  const history = await personaHistory(
    fixture.owner,
    fixture.workspaceId,
    fixture.personaId,
  );
  assert(history.revisions[0].approval);
  await assert.rejects(
    db.personaRevision.update({
      where: { id: history.revisions[0].id },
      data: { content: {} as Prisma.InputJsonValue },
    }),
    /Immutable record/,
  );
  const share = await readShare(fixture.shareToken, null);
  assert.equal((share.content as { name: string }).name, "Recovery audience");
  const source = await db.researchSource.findUniqueOrThrow({
    where: { id: fixture.sourceId },
  });
  assert.equal((await getFile(source.fileKey!)).toString(), fixture.text);
  const exp = await db.exportJob.findUniqueOrThrow({
    where: { id: fixture.exportId },
  });
  assert.equal((await getFile(exp.fileKey!)).subarray(0, 4).toString(), "%PDF");
  console.log("PASS restored service probe");
} finally {
  await db.$disconnect();
}
