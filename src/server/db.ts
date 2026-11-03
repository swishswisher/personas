import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { personasDb?: PrismaClient };
export const db =
  globalDb.personasDb ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://unconfigured@localhost:5432/personas",
      max: 5,
      connectionTimeoutMillis: 10000,
    }),
  });
if (process.env.NODE_ENV !== "production") globalDb.personasDb = db;
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
