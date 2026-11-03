import "dotenv/config";
import { db } from "../src/server/db";
const [email, role, reason] = process.argv.slice(2);
if (
  !email ||
  !["admin", "support", "none"].includes(role) ||
  !reason ||
  reason.length < 10
)
  throw new Error(
    'Usage: node --import tsx scripts/grant-staff.ts verified-email admin|support|none "recorded reason"',
  );
const operator = process.env.OPERATOR_ID;
if (!operator)
  throw new Error("Set OPERATOR_ID to the accountable operator identity.");
const user = await db.user.findUnique({
  where: { email: email.toLowerCase() },
});
if (!user?.emailVerified) throw new Error("A verified account is required.");
await db.$transaction([
  db.user.update({
    where: { id: user.id },
    data: { staffRole: role === "none" ? null : role },
  }),
  db.auditEvent.create({
    data: {
      actorId: operator,
      action: "staff.role_changed",
      targetId: user.id,
      detail: { role, reason },
    },
  }),
]);
console.log("Staff access updated and audited for user", user.id);
await db.$disconnect();
