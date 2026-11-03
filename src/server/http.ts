import { ensure, AppError } from "@/lib/domain";
export async function readJson(
  request: Request,
  maxBytes = 512 * 1024,
): Promise<unknown> {
  ensure(
    Number(request.headers.get("content-length") || 0) <= maxBytes,
    413,
    "request_size",
    "This request is too large. Use a file upload for larger research.",
  );
  const reader = request.body?.getReader();
  ensure(reader, 400, "request_body", "A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError(413, "request_size", "This request is too large.");
    }
    chunks.push(result.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(
      400,
      "invalid_json",
      "The request body is not valid JSON.",
    );
  }
}
