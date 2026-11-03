-- Durable private objects for the Vercel + Neon MVP; encrypted before persistence.
CREATE TABLE "PrivateObject" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "ciphertext" BYTEA NOT NULL,
  "iv" BYTEA NOT NULL,
  "tag" BYTEA NOT NULL,
  "mime" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivateObject_size" CHECK ("bytes" > 0 AND "bytes" <= 12582912),
  CONSTRAINT "PrivateObject_iv" CHECK (octet_length("iv") = 12),
  CONSTRAINT "PrivateObject_tag" CHECK (octet_length("tag") = 16)
);
