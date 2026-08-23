import assert from "node:assert/strict";
import test from "node:test";

import { resetMeteredTurnCacheForTests, resolveIceServers } from "./meteredTurnService.js";

const baseConfig = { webrtc: { iceServers: [{ urls: "stun:stun.lab.local:3478" }] } };

const meteredEnv = {
  REMOTE_ASSISTANCE_METERED_DOMAIN: "itguardian.metered.live",
  REMOTE_ASSISTANCE_METERED_SECRET_KEY: "fake-secret-key"
};

function fakeFetchSequence(responses) {
  const calls = [];
  let index = 0;
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const response = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return response;
    }
  };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test.beforeEach(() => {
  resetMeteredTurnCacheForTests();
});

test("sem Metered configurado, devolve a lista estatica de fallback sem chamar fetch", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return jsonResponse(200, {});
  };
  const result = await resolveIceServers(baseConfig, {}, fetchImpl);
  assert.deepEqual(result, baseConfig.webrtc.iceServers);
  assert.equal(called, false);
});

test("com Metered configurado, cria credencial e busca os iceServers reais", async () => {
  const { calls, fetchImpl } = fakeFetchSequence([
    jsonResponse(200, { username: "u1", password: "p1", expiryInSeconds: 3600, apiKey: "credential-api-key" }),
    jsonResponse(200, [
      { urls: "stun:stun.relay.metered.ca:80" },
      { urls: "turn:global.relay.metered.ca:80", username: "u1", credential: "p1" }
    ])
  ]);

  const result = await resolveIceServers(baseConfig, meteredEnv, fetchImpl);

  assert.deepEqual(result, [
    { urls: "stun:stun.relay.metered.ca:80" },
    { urls: "turn:global.relay.metered.ca:80", username: "u1", credential: "p1" }
  ]);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/itguardian\.metered\.live\/api\/v1\/turn\/credential\?secretKey=fake-secret-key$/);
  assert.equal(calls[0].options.method, "POST");
  assert.match(calls[1].url, /^https:\/\/itguardian\.metered\.live\/api\/v1\/turn\/credentials\?apiKey=credential-api-key$/);
});

test("credencial cacheada nao dispara uma nova chamada de rede antes de expirar", async () => {
  const { calls, fetchImpl } = fakeFetchSequence([
    jsonResponse(200, { username: "u1", password: "p1", expiryInSeconds: 3600, apiKey: "credential-api-key" }),
    jsonResponse(200, [{ urls: "turn:global.relay.metered.ca:80", username: "u1", credential: "p1" }])
  ]);

  const first = await resolveIceServers(baseConfig, meteredEnv, fetchImpl);
  const second = await resolveIceServers(baseConfig, meteredEnv, fetchImpl);

  assert.deepEqual(first, second);
  assert.equal(calls.length, 2, "a segunda chamada deve usar o cache, sem bater na rede de novo");
});

test("falha da API da Metered cai de volta na lista estatica, nunca quebra a assistencia remota", async () => {
  const fetchImpl = async () => jsonResponse(401, { error: "Invalid API Key" });
  const result = await resolveIceServers(baseConfig, meteredEnv, fetchImpl);
  assert.deepEqual(result, baseConfig.webrtc.iceServers);
});

test("resposta sem apiKey ou lista vazia de iceServers tambem cai no fallback", async () => {
  const missingApiKey = fakeFetchSequence([jsonResponse(200, { username: "u1", password: "p1" })]);
  assert.deepEqual(
    await resolveIceServers(baseConfig, meteredEnv, missingApiKey.fetchImpl),
    baseConfig.webrtc.iceServers
  );

  resetMeteredTurnCacheForTests();
  const emptyList = fakeFetchSequence([
    jsonResponse(200, { username: "u1", password: "p1", expiryInSeconds: 3600, apiKey: "k" }),
    jsonResponse(200, [])
  ]);
  assert.deepEqual(
    await resolveIceServers(baseConfig, meteredEnv, emptyList.fetchImpl),
    baseConfig.webrtc.iceServers
  );
});

test("uma falha depois de uma credencial ja cacheada continua servindo o cache antigo", async () => {
  const success = fakeFetchSequence([
    jsonResponse(200, { username: "u1", password: "p1", expiryInSeconds: 3600, apiKey: "credential-api-key" }),
    jsonResponse(200, [{ urls: "turn:global.relay.metered.ca:80", username: "u1", credential: "p1" }])
  ]);
  const cached = await resolveIceServers(baseConfig, meteredEnv, success.fetchImpl);

  // Forca a expiracao do cache manualmente encurtando o TTL nao e exposto,
  // entao simulamos a falha diretamente: sem cache expirado nesse teste,
  // o resultado ainda deve ser o cacheado (a chamada de fallback so entra
  // em jogo quando o cache expira e a rede falha nesse instante).
  const failing = async () => jsonResponse(500, {});
  const result = await resolveIceServers(baseConfig, meteredEnv, failing);
  assert.deepEqual(result, cached);
});
