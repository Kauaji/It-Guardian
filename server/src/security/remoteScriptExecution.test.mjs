import assert from "node:assert/strict";
import test from "node:test";

import { isRemoteScriptExecutionEnabled } from "../config/environment.js";
import { queueAgentScriptJob } from "../repositories/agentScriptJobRepository.js";

test("execucao remota permanece desabilitada por padrao", () => {
  assert.equal(isRemoteScriptExecutionEnabled({}), false);
  assert.equal(isRemoteScriptExecutionEnabled({ ENABLE_REMOTE_SCRIPT_EXECUTION: "false" }), false);
  assert.equal(isRemoteScriptExecutionEnabled({ ENABLE_REMOTE_SCRIPT_EXECUTION: "true" }), true);
});

test("fila recusa script antes de consultar o banco quando a flag esta desligada", async () => {
  const previous = process.env.ENABLE_REMOTE_SCRIPT_EXECUTION;
  delete process.env.ENABLE_REMOTE_SCRIPT_EXECUTION;
  let queried = false;

  try {
    await assert.rejects(
      queueAgentScriptJob({
        script: { id: "script-1", type: "bat", content: "echo teste" },
        assetId: "asset-1",
        executionLogId: "log-1",
        db: async () => {
          queried = true;
          return { rows: [] };
        }
      }),
      (error) => error.code === "REMOTE_SCRIPT_EXECUTION_DISABLED" && error.statusCode === 503
    );
    assert.equal(queried, false);
  } finally {
    if (previous == null) delete process.env.ENABLE_REMOTE_SCRIPT_EXECUTION;
    else process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = previous;
  }
});
