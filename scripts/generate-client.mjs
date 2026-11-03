import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { getGenerators } = require("@prisma/internals");
const { PrismaClientTsGenerator } = require("@prisma/client-generator-ts");

// Prisma 7's TypeScript client uses the bundled WASM compiler and driver adapter.
// It requires no native engine; keep generator packages pinned to the client.
const generators = await getGenerators({
  schemaPath: fileURLToPath(
    new URL("../prisma/schema.prisma", import.meta.url),
  ),
  registry: {
    "prisma-client": {
      type: "in-process",
      generator: new PrismaClientTsGenerator(),
    },
  },
  skipDownload: true,
  cliCommand: "generate",
});
try {
  for (const generator of generators) {
    if (generator.manifest?.requiresEngines?.length)
      throw new Error(
        "This client unexpectedly requires a native engine. Use the normal Prisma CLI with verified downloads.",
      );
    await generator.generate();
  }
  console.log(
    "Generated Prisma TypeScript client using the bundled WASM compiler.",
  );
} finally {
  for (const generator of generators) generator.stop();
}
