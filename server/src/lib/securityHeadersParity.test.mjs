import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const vercel = JSON.parse(readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8"));
const nginx = readFileSync(new URL("../../../client/nginx.conf", import.meta.url), "utf8");

const vercelHeaders = Object.fromEntries(
  vercel.headers.find((rule) => rule.source === "/(.*)").headers.map((header) => [header.key, header.value])
);
const nginxHeaders = Object.fromEntries(
  [...nginx.matchAll(/add_header\s+([A-Za-z-]+)\s+"([^"]+)"/g)].map((match) => [match[1], match[2]])
);

// `upgrade-insecure-requests` so faz sentido atras de TLS do host (Vercel); o nginx do contêiner pode estar em HTTP.
const withoutUpgrade = (csp) => csp.replace(/;?\s*upgrade-insecure-requests/, "");

test("vercel.json e nginx.conf aplicam os mesmos cabecalhos de seguranca", () => {
  for (const key of Object.keys(vercelHeaders)) {
    assert.ok(key in nginxHeaders, `nginx.conf nao define ${key}`);
    const expected = key === "Content-Security-Policy" ? withoutUpgrade(vercelHeaders[key]) : vercelHeaders[key];
    assert.equal(nginxHeaders[key], expected, `${key} diverge entre vercel.json e nginx.conf`);
  }
});

test("a CSP do cliente nao permite origens externas nem script inline/eval", () => {
  const csp = vercelHeaders["Content-Security-Policy"];
  assert.doesNotMatch(csp, /https?:\/\//, "CSP nao pode listar origens externas");
  const scriptSrc = /script-src ([^;]+)/.exec(csp)[1];
  assert.equal(scriptSrc.trim(), "'self'");
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
});
