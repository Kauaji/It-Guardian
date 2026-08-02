import assert from "node:assert/strict";
import test from "node:test";

process.env.JWT_SECRET ||= "it-guardian-public-machine-token-test-secret-32-chars";

const { createPublicMachineToken, verifyPublicMachineToken } = await import("./publicMachineToken.js");

test("token publico identifica somente a ativacao assinada", () => {
  const token = createPublicMachineToken("activation-123");
  assert.equal(verifyPublicMachineToken(token), "activation-123");
  assert.equal(verifyPublicMachineToken(`${token}alterado`), null);
  assert.equal(verifyPublicMachineToken(""), null);
});
