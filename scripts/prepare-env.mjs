import { randomBytes } from "node:crypto";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const value = (name) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const origin = new URL(value("--origin") || "http://localhost:3100");
if (
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  !["http:", "https:"].includes(origin.protocol) ||
  (origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(origin.hostname))
)
  throw new Error(
    "Use an exact HTTPS application origin, or HTTP localhost for development.",
  );
const root = resolve(value("--directory") || process.cwd());
await mkdir(root, { recursive: true, mode: 0o700 });
const runtime = `# Private generated runtime configuration. Never commit or share.\nDATABASE_URL=\nDIRECT_DATABASE_URL=\nAPP_URL=${origin.origin}\nBETTER_AUTH_URL=${origin.origin}\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\nFILE_STORAGE=database\nFILE_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}\nJOB_EXECUTION=after\nCRON_SECRET=${randomBytes(32).toString("base64url")}\nUPLOAD_SCAN_URL=\nUPLOAD_SCAN_TOKEN=${randomBytes(32).toString("base64url")}\nLOCAL_EMAIL_CAPTURE=false\n`;
const files = { ".env.runtime": runtime };
for (const name of ["google", "email", "integrations"])
  files[`.env.${name}`] = await readFile(
    fileURLToPath(new URL(`../config/${name}.env.example`, import.meta.url)),
    "utf8",
  );
for (const [name, content] of Object.entries(files)) {
  try {
    await writeFile(resolve(root, name), content, { mode: 0o600, flag: "wx" });
    console.log("Created", name);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log("Preserved existing", name);
  }
}
console.log(
  "Secrets were not printed. Apply runtime values securely to the matching Vercel environment; Next.js does not automatically load these split files.",
);
