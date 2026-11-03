import { createServer } from "node:http";
import { createConnection } from "node:net";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

export function clamavCommand(command, body, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({
      host: options.host || "clamav",
      port: options.port || 3310,
    });
    let output = Buffer.alloc(0);
    socket.setTimeout(30000, () =>
      socket.destroy(new Error("Scanner timed out")),
    );
    socket.on("error", reject);
    socket.on("connect", () => {
      socket.write(`z${command}\0`);
      if (body) {
        for (let start = 0; start < body.length; start += 65536) {
          const chunk = body.subarray(start, start + 65536);
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);
          socket.write(length);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      }
    });
    socket.on("data", (chunk) => {
      output = Buffer.concat([output, chunk]);
      if (output.length > 4096)
        return socket.destroy(new Error("Invalid scanner response"));
      if (output.includes(0)) {
        resolve(output.toString().replace(/\0.*$/s, "").trim());
        socket.destroy();
      }
    });
    socket.on("end", () => {
      if (!output.includes(0)) reject(new Error("Incomplete scanner response"));
    });
  });
}

export function createScannerServer({
  token,
  host = "clamav",
  port = 3310,
  maxSignatureAgeHours = 72,
}) {
  if (!token || token.length < 32)
    throw new Error("A scanner token of at least 32 characters is required");
  let active = 0;
  async function ready() {
    const version = await clamavCommand("VERSION", undefined, { host, port });
    const date = Date.parse(version.split("/").at(-1));
    if (
      !Number.isFinite(date) ||
      Date.now() - date > maxSignatureAgeHours * 3600000 ||
      date > Date.now() + 3600000
    )
      throw new Error("Scanner signatures are missing or stale");
  }
  const server = createServer(async (request, response) => {
    const send = (status, data) => {
      response.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(data));
    };
    try {
      if (request.url === "/health" && request.method === "GET") {
        await ready();
        return send(200, { ready: true });
      }
      if (request.url !== "/scan" || request.method !== "POST")
        return send(404, { clean: false });
      const actual = Buffer.from(request.headers.authorization || ""),
        expected = Buffer.from("Bearer " + token);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      ) {
        request.resume();
        return send(401, { clean: false });
      }
      if (active >= 2) {
        request.resume();
        return send(503, { clean: false });
      }
      active++;
      try {
        await ready();
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 10 * 1024 * 1024) {
            send(413, { clean: false });
            request.destroy();
            return;
          }
          chunks.push(chunk);
        }
        if (!size) return send(400, { clean: false });
        const result = await clamavCommand("INSTREAM", Buffer.concat(chunks), {
          host,
          port,
        });
        if (result === "stream: OK") return send(200, { clean: true });
        if (/ FOUND$/.test(result)) return send(200, { clean: false });
        throw new Error("Scanner did not complete successfully");
      } finally {
        active--;
      }
    } catch {
      if (!response.headersSent) send(503, { clean: false });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 32;
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createScannerServer({
    token: process.env.UPLOAD_SCAN_TOKEN,
    host: process.env.CLAMAV_HOST || "clamav",
    port: Number(process.env.CLAMAV_PORT || 3310),
  });
  server.listen(8080, process.env.SCANNER_BIND_HOST || "0.0.0.0", () =>
    console.log("Private scanner adapter listening"),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => server.close(() => process.exit(0)));
}
