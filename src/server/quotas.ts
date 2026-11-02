import type { Tx } from "./db";
import { effectivePlan } from "./subscriptions";
import { ensure } from "@/lib/domain";
export async function reserveSourceCapacity(
  tx: Tx,
  workspaceId: string,
  bytes: number,
) {
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
  const [subscription, usage] = await Promise.all([
    tx.subscription.findUnique({ where: { workspaceId } }),
    tx.researchSource.aggregate({
      where: { workspaceId, deletedAt: null },
      _sum: { bytes: true },
    }),
  ]);
  ensure(
    (usage._sum.bytes || 0) + bytes <=
      effectivePlan(subscription).storageMB * 1024 * 1024,
    402,
    "storage_limit",
    "This workspace has reached its research storage allowance. Remove unused sources or change the plan.",
  );
}
