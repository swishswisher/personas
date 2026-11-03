import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
git(["fetch", "--no-tags", "origin", "master"]);
const base = git(["rev-parse", "origin/master"]);
const remote = git(["ls-tree", "-r", "--name-only", base, ".github/workflows"]);
const local = existsSync(".github/workflows")
  ? readdirSync(".github/workflows").filter((f) => /\.ya?ml$/.test(f))
  : [];
if (remote || local.length)
  throw new Error(
    "Push blocked: Actions workflows exist and their triggers require review. Retain tested changes locally.",
  );
const result = {
  checkedAt: new Date().toISOString(),
  repository: "swishswisher/personas",
  baseBranch: "master",
  baseCommit: base,
  remoteWorkflowFiles: [],
  localWorkflowFiles: [],
  repositoryRulesets:
    "Not checked by this script; inspect repository and organization rules before publication.",
  actionsUsed: false,
  decision:
    "No workflow files found on the inspected base or checkout. Keep commits local; this check does not authorize a push or verify organization rules.",
};
mkdirSync("docs/evidence", { recursive: true });
writeFileSync(
  "docs/evidence/actions-safety.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(result.decision);
