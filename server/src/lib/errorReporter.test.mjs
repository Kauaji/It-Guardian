import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSentryEvent,
  parseSentryDsn,
  reportError,
  resetErrorReporterState,
  setErrorReporterTransport
} from "./errorReporter.js";

function withEnv(values, fn) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

test("parseSentryDsn extrai o endpoint de envelopes e a chave publica", () => {
  assert.deepEqual(parseSentryDsn("https://chave@o1.ingest.sentry.io/123"), {
    endpoint: "https://o1.ingest.sentry.io/api/123/envelope/",
    publicKey: "chave"
  });
  assert.equal(parseSentryDsn("isso-nao-e-dsn"), null);
});

test("sem destino configurado nao faz nada", async () => {
  resetErrorReporterState();
  await withEnv({ SENTRY_DSN: undefined, ERROR_WEBHOOK_URL: undefined }, async () => {
    assert.equal(await reportError(new Error("x")), false);
  });
});

test("envia envelope ao Sentry e JSON ao webhook, sem token na URL", async () => {
  resetErrorReporterState();
  const calls = [];
  setErrorReporterTransport(async (url, init) => calls.push({ url, init }));
  try {
    await withEnv({ SENTRY_DSN: "https://chave@o1.ingest.sentry.io/123", ERROR_WEBHOOK_URL: "https://hooks.example.com/x" }, async () => {
      const error = new Error("falha de teste");
      assert.equal(await reportError(error, { requestId: "req-12345678", method: "GET", path: "/api/public/service-orders/track/SEGREDO?a=1" }), true);
    });
  } finally {
    setErrorReporterTransport(null);
  }
  assert.equal(calls.length, 2);
  const sentry = calls.find((call) => call.url.includes("sentry.io"));
  assert.match(sentry.init.headers["x-sentry-auth"], /sentry_key=chave/);
  const [header, itemHeader, event] = sentry.init.body.split("\n").map((line) => JSON.parse(line));
  assert.ok(header.event_id);
  assert.equal(itemHeader.type, "event");
  assert.equal(event.exception.values[0].value, "falha de teste");
  assert.doesNotMatch(sentry.init.body, /SEGREDO/);
  const hook = calls.find((call) => call.url.includes("hooks.example.com"));
  assert.doesNotMatch(hook.init.body, /SEGREDO/);
});

test("limita a taxa de erros iguais", async () => {
  resetErrorReporterState();
  let sent = 0;
  setErrorReporterTransport(async () => { sent += 1; });
  try {
    await withEnv({ ERROR_WEBHOOK_URL: "https://hooks.example.com/x", SENTRY_DSN: undefined }, async () => {
      const error = new Error("repetido");
      for (let index = 0; index < 20; index += 1) await reportError(error);
    });
  } finally {
    setErrorReporterTransport(null);
  }
  assert.equal(sent, 5);
});

test("buildSentryEvent monta frames a partir do stack", () => {
  const event = buildSentryEvent(new Error("boom"), { requestId: "abc-12345" });
  assert.ok(event.exception.values[0].stacktrace.frames.length > 0);
  assert.equal(event.tags.requestId, "abc-12345");
});
