import assert from "node:assert/strict";
import test from "node:test";
import { rejectDangerousInput, requireMetricsToken } from "./securityMiddleware.js";

function probe() {
  const result = { status: null, body: null, headers: {}, nexted: false };
  const res = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
    setHeader(name, value) { result.headers[name] = value; }
  };
  return { result, res, next: () => { result.nexted = true; } };
}

test("recusa corpo com chave de poluicao de prototipo, em qualquer profundidade", () => {
  for (const body of [
    JSON.parse('{"__proto__":{"admin":true}}'),
    JSON.parse('{"a":{"b":[{"constructor":{"prototype":{}}}]}}'),
    JSON.parse('{"prototype":1}')
  ]) {
    const { result, res, next } = probe();
    rejectDangerousInput({ body, query: {} }, res, next);
    assert.equal(result.status, 400, JSON.stringify(body));
    assert.equal(result.nexted, false);
  }
});

test("aceita corpos normais", () => {
  const { result, res, next } = probe();
  rejectDangerousInput({ body: { nome: "ok", itens: [{ a: 1 }] }, query: { q: "x" } }, res, next);
  assert.equal(result.nexted, true);
});

test("/metrics: 404 sem METRICS_TOKEN, 401 com token errado, passa com o certo", () => {
  const previous = process.env.METRICS_TOKEN;
  try {
    delete process.env.METRICS_TOKEN;
    let probed = probe();
    requireMetricsToken({ headers: {} }, probed.res, probed.next);
    assert.equal(probed.result.status, 404);

    process.env.METRICS_TOKEN = "token-de-metricas-longo";
    probed = probe();
    requireMetricsToken({ headers: { authorization: "Bearer errado" } }, probed.res, probed.next);
    assert.equal(probed.result.status, 401);

    probed = probe();
    requireMetricsToken({ headers: { authorization: "Bearer token-de-metricas-longo" } }, probed.res, probed.next);
    assert.equal(probed.result.nexted, true);
  } finally {
    if (previous === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = previous;
  }
});
