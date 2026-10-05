import assert from "node:assert/strict";
import test from "node:test";

process.env.JWT_SECRET ||= "it-guardian-public-tracking-token-test-secret-32c";

const { createPublicServiceOrderTrackingToken, verifyPublicServiceOrderTrackingToken } = await import(
  "./publicServiceOrderTrackingToken.js"
);
const { createPublicMachineToken, verifyPublicMachineToken } = await import("./publicMachineToken.js");

test("token de acompanhamento identifica somente a OS assinada", () => {
  const token = createPublicServiceOrderTrackingToken("order-123");
  assert.equal(verifyPublicServiceOrderTrackingToken(token), "order-123");
  assert.equal(verifyPublicServiceOrderTrackingToken(`${token}alterado`), null);
  assert.equal(verifyPublicServiceOrderTrackingToken(""), null);
});

test("token de acompanhamento e o token de identidade de maquina nao sao intercambiaveis (audiences distintas)", () => {
  const machineToken = createPublicMachineToken("activation-123");
  const trackingToken = createPublicServiceOrderTrackingToken("order-123");

  assert.equal(verifyPublicServiceOrderTrackingToken(machineToken), null, "token de maquina nao deve valer como token de acompanhamento");
  assert.equal(verifyPublicMachineToken(trackingToken), null, "token de acompanhamento nao deve valer como token de maquina");
});
