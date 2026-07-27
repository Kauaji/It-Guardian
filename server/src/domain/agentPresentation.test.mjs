import assert from "node:assert/strict";
import test from "node:test";
import {
  getAgentHeartbeatState,
  getMachineSourceLabel,
  isAgentMachine
} from "../../../client/src/components/inventory/agentPresentation.js";

const now = Date.parse("2026-07-27T12:00:00.000Z");

test("apresentacao identifica origem Agent e heartbeat recente", () => {
  const machine = {
    source: "agent",
    lastSeenAt: "2026-07-27T11:59:00.000Z",
    agent: { intervalSeconds: 60 }
  };

  assert.equal(isAgentMachine(machine), true);
  assert.equal(getMachineSourceLabel(machine), "Agent");
  assert.deepEqual(getAgentHeartbeatState(machine, { now }), {
    status: "online",
    lastSeenAt: machine.lastSeenAt
  });
});

test("apresentacao marca heartbeat atrasado como offline", () => {
  const machine = {
    source: "agent",
    agent: {
      lastSeenAt: "2026-07-27T11:50:00.000Z",
      intervalSeconds: 60
    }
  };

  assert.deepEqual(getAgentHeartbeatState(machine, { now }), {
    status: "offline",
    lastSeenAt: machine.agent.lastSeenAt
  });
});

test("maquina manual continua compativel sem dados de agente", () => {
  const machine = { source: "manual", name: "Impressora local" };

  assert.equal(isAgentMachine(machine), false);
  assert.equal(getMachineSourceLabel(machine), "Manual");
  assert.deepEqual(getAgentHeartbeatState(machine, { now }), {
    status: null,
    lastSeenAt: null
  });
});
