// Serve client/dist como a producao: aplica os cabecalhos de vercel.json (CSP, nosniff, COOP...) e faz proxy de /api
// para a API. Usado pelo teste e2e de CSP (tests/e2e/csp.spec.js) para provar que o app roda SEM violar a politica.
//   node scripts/serve-dist.mjs --port 5175 --api http://127.0.0.1:4100
// Como a verificacao roda em http://127.0.0.1, `upgrade-insecure-requests` e HSTS sao omitidos (sao no-ops/danosos sem TLS).
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const distDir = path.join(root, "client", "dist");

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const port = Number(option("port", "5175"));
const api = new URL(option("api", "http://127.0.0.1:4100"));

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  process.stderr.write("client/dist ausente: rode `npm run build` antes.\n");
  process.exit(1);
}

const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const securityHeaders = Object.fromEntries(
  vercel.headers
    .filter((rule) => rule.source === "/(.*)")
    .flatMap((rule) => rule.headers)
    .filter((header) => header.key !== "Strict-Transport-Security")
    .map((header) => [
      header.key,
      header.key === "Content-Security-Policy" ? header.value.replace(/;?\s*upgrade-insecure-requests/, "") : header.value
    ])
);

const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".glb": "model/gltf-binary", ".webmanifest": "application/manifest+json", ".txt": "text/plain"
};

function sendFile(res, file) {
  res.writeHead(200, { ...securityHeaders, "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/") || req.url === "/api" || req.url.startsWith("/health")) {
    const upstream = http.request(
      { host: api.hostname, port: api.port, path: req.url, method: req.method, headers: { ...req.headers, host: api.host, origin: `http://127.0.0.1:${port}` } },
      (response) => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      }
    );
    upstream.on("error", () => res.writeHead(502).end("API indisponivel"));
    req.pipe(upstream);
    return;
  }
  const requested = path.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidate = path.join(distDir, requested);
  if (candidate.startsWith(distDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return sendFile(res, candidate);
  sendFile(res, path.join(distDir, "index.html")); // fallback de SPA, como o rewrite do vercel.json
});

server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(Number(api.port), api.hostname, () => {
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries({ ...req.headers, host: api.host }).map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n`);
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
});

server.listen(port, "127.0.0.1", () => process.stdout.write(`dist em http://127.0.0.1:${port}\n`));
