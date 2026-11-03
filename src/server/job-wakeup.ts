import { after } from "next/server";
import { runJobs } from "./jobs";
import { log } from "./security";

// Keep the durable queue authoritative. This only wakes active workloads;
// scheduled polling remains necessary for retries when the site is idle.
export function scheduleJobs() {
  const execution =
    process.env.JOB_EXECUTION || (process.env.VERCEL ? "after" : "manual");
  if (execution !== "after") return;
  after(async () => {
    try {
      await runJobs(5, { budgetMs: 20000 });
    } catch {
      log("jobs.wakeup_failed");
    }
  });
}
