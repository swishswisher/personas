import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { ensure } from "@/lib/domain";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { db } from "./db";
const isS3 = () => process.env.FILE_STORAGE === "s3";
const isDatabase = () => process.env.FILE_STORAGE === "database";
function encryptionKey() {
  const encoded = process.env.FILE_ENCRYPTION_KEY || "";
  const key = Buffer.from(encoded, "base64");
  ensure(
    key.length === 32 && key.toString("base64") === encoded,
    503,
    "storage_config",
    "Configure a stable 32-byte base64 private-storage encryption key.",
  );
  return key;
}
const s3 = () =>
  new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: process.env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        }
      : undefined,
  });
function localPath(key: string) {
  ensure(
    /^[a-zA-Z0-9/_\-.]+$/.test(key) && !key.includes(".."),
    400,
    "file_key",
    "Invalid file identifier.",
  );
  const root = resolve(
    /* turbopackIgnore: true */ process.env.LOCAL_STORAGE_DIR || ".data/files",
  );
  const path = resolve(root, key);
  ensure(
    path.startsWith(root + "/"),
    400,
    "file_key",
    "Invalid file identifier.",
  );
  return path;
}
export async function putFile(key: string, body: Uint8Array, mime: string) {
  if (isDatabase()) {
    ensure(
      body.length > 0 && body.length <= 12 * 1024 * 1024,
      413,
      "storage_size",
      "This private object exceeds the storage limit.",
    );
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    // Authenticate the identifier so ciphertext cannot be swapped between keys.
    cipher.setAAD(Buffer.from(key));
    const ciphertext = Buffer.concat([cipher.update(body), cipher.final()]);
    const data = {
      ciphertext,
      iv,
      tag: cipher.getAuthTag(),
      mime,
      bytes: body.length,
    };
    await db.privateObject.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
    });
  } else if (isS3()) {
    ensure(
      process.env.S3_BUCKET,
      503,
      "storage_config",
      "Private file storage is not configured.",
    );
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: mime,
        ServerSideEncryption: "AES256",
      }),
    );
  } else {
    ensure(
      process.env.NODE_ENV !== "production" ||
        process.env.ALLOW_LOCAL_STORAGE === "true",
      503,
      "storage_config",
      "Configure durable private file storage.",
    );
    const path = localPath(key);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, body, { mode: 0o600 });
  }
}
export async function getFile(key: string) {
  if (isDatabase()) {
    const object = await db.privateObject.findUnique({ where: { key } });
    ensure(
      object,
      404,
      "file_unavailable",
      "This private object is unavailable.",
    );
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        encryptionKey(),
        object.iv,
      );
      decipher.setAAD(Buffer.from(key));
      decipher.setAuthTag(object.tag);
      return Buffer.concat([
        decipher.update(object.ciphertext),
        decipher.final(),
      ]);
    } catch {
      throw new Error(
        "Private storage could not authenticate this object. Check the encryption-key binding.",
      );
    }
  }
  if (isS3()) {
    const result = await s3().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
    return Buffer.from(await result.Body!.transformToByteArray());
  }
  return readFile(/* turbopackIgnore: true */ localPath(key));
}
export async function deleteFile(key: string) {
  if (isDatabase()) await db.privateObject.deleteMany({ where: { key } });
  else if (isS3())
    await s3().send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
  else await unlink(localPath(key)).catch(() => {});
}
export async function scanFile(body: Buffer, mime: string) {
  if (process.env.UPLOAD_SCAN_URL) {
    const response = await fetch(process.env.UPLOAD_SCAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": mime,
        Authorization: `Bearer ${process.env.UPLOAD_SCAN_TOKEN}`,
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(30000),
    });
    ensure(
      response.ok,
      503,
      "scan_failed",
      "The file security check is unavailable. Retry later.",
    );
    const data = await response.json();
    ensure(
      data.clean === true,
      422,
      "unsafe_file",
      "The security check did not accept this file.",
    );
  } else
    ensure(
      process.env.NODE_ENV !== "production" || mime !== "application/pdf",
      503,
      "scan_config",
      "PDF uploads require the configured file security scanner. You can paste research text instead.",
    );
}
