import assert from "node:assert/strict";
import test from "node:test";

import { resolveAgentConnectionEvent, resolveOfflineThresholdSeconds, wasAgentStale } from "./agentPresence.js";

const now = Date.parse("2026-01-01T12:00:00.000Z");
const minutesAgo = (minutes) => new Date(now - minutes * 60_000).toISOString();

test("limite de silencio vem do ambiente, em segundos ou minutos", () => {
  assert.equal(resolveOfflineThresholdSeconds({}), 600);
  assert.equal(resolveOfflineThresholdSeconds({ AGENT_OFFLINE_AFTER_MINUTES: "3" }), 180);
  assert.equal(resolveOfflineThresholdSeconds({ AGENT_OFFLINE_AFTER_SECONDS: "90" }), 90);
  assert.equal(
    resolveOfflineThresholdSeconds({ AGENT_OFFLINE_AFTER_SECONDS: "90", AGENT_OFFLINE_AFTER_MINUTES: "3" }),
    90,
    "segundos tem precedencia"
  );
});

test("maquina so e considerada em silencio acima do maior entre o limite e tres intervalos", () => {
  const base = { payloadIntervalSeconds: 60, configuredThresholdSeconds: 600, now };

  assert.equal(wasAgentStale({ ...base, previous: null }), false);
  assert.equal(wasAgentStale({ ...base, previous: { lastSeenAt: minutesAgo(5), intervalSeconds: 60 } }), false);
  assert.equal(wasAgentStale({ ...base, previous: { lastSeenAt: minutesAgo(11), intervalSeconds: 60 } }), true);
  assert.equal(
    wasAgentStale({ ...base, previous: { lastSeenAt: minutesAgo(11), intervalSeconds: 600 } }),
    false,
    "tres vezes o intervalo anterior (30 min) amplia a tolerancia"
  );
  assert.equal(
    wasAgentStale({ ...base, previous: { lastSeenAt: minutesAgo(11), intervalSeconds: null }, payloadIntervalSeconds: 600 }),
    false,
    "sem intervalo anterior usa o do payload"
  );
  assert.equal(
    wasAgentStale({ ...base, configuredThresholdSeconds: 60, previous: { lastSeenAt: minutesAgo(2), intervalSeconds: 30 } }),
    true
  );
});

test("evento de conexao: primeiro registro, reconexao ou nada", () => {
  const payload = { hostname: "PC-01", agentVersion: "1.2.3", intervalSeconds: 60 };
  const first = resolveAgentConnectionEvent({ previous: null, payload, enrollmentId: "e1", env: {}, now });
  assert.equal(first.eventType, "agent_enrolled");
  assert.equal(first.message, "Agente IT Guardian registrado na maquina PC-01.");
  assert.deepEqual(JSON.parse(first.newValue), { agentVersion: "1.2.3", source: "agent", enrollmentId: "e1" });

  const recent = { lastSeenAt: minutesAgo(1), intervalSeconds: 60 };
  assert.equal(resolveAgentConnectionEvent({ previous: recent, payload, enrollmentId: "e1", env: {}, now }), null);

  const stale = { lastSeenAt: minutesAgo(40), intervalSeconds: 60 };
  const reconnected = resolveAgentConnectionEvent({ previous: stale, payload, enrollmentId: "e1", env: {}, now });
  assert.equal(reconnected.eventType, "agent_reconnected");
  assert.equal(reconnected.message, "Agente IT Guardian voltou a comunicar na maquina PC-01.");

  assert.equal(
    resolveAgentConnectionEvent({
      previous: { lastSeenAt: minutesAgo(5), intervalSeconds: 30 },
      payload,
      enrollmentId: "e1",
      env: { AGENT_OFFLINE_AFTER_SECONDS: "120" },
      now
    }).eventType,
    "agent_reconnected"
  );
});
