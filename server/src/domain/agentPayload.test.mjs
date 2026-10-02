import assert from "node:assert/strict";
import test from "node:test";

import {
  validateAgentPayload,
  validateEnrollmentName,
  validateJobResultPayload
} from "./agentPayload.js";
import { compareVersions, isUpdateAvailable } from "./agentVersion.js";

function validInput(overrides = {}) {
  return {
    machineId: "m-1",
    hostname: "PC-01",
    operatingSystem: "Windows 11",
    osArchitecture: "64-bit",
    agentVersion: "1.0.0",
    collectedAt: "2026-01-01T10:00:00-03:00",
    ...overrides
  };
}

test("payload minimo valido recebe valores padrao e data normalizada", () => {
  const payload = validateAgentPayload(validInput());

  assert.equal(payload.collectedAt, "2026-01-01T13:00:00.000Z");
  assert.equal(payload.intervalSeconds, 300);
  assert.deepEqual(payload.inventoryDetails, {});
  assert.equal(payload.machineAlias, null);
  assert.equal(payload.cpuUsagePercent, null);
});

test("remove caracteres NUL de textos, chaves e valores aninhados", () => {
  const payload = validateAgentPayload(validInput({
    hostname: "PC\u0000-01",
    inventoryDetails: { "chave\u0000": ["a\u0000b", { "x\u0000": "y\u0000" }], numero: 3, nulo: null }
  }));

  assert.equal(payload.hostname, "PC-01");
  assert.deepEqual(payload.inventoryDetails, { chave: ["ab", { x: "y" }], numero: 3, nulo: null });
});

test("rejeita payload invalido com erro 400", () => {
  const invalid = [
    null,
    [],
    "texto",
    validInput({ desconhecido: 1 }),
    validInput({ collectedAt: "ontem" }),
    validInput({ machineId: "  " }),
    validInput({ hostname: "x".repeat(181) }),
    validInput({ cpuUsagePercent: 101 }),
    validInput({ intervalSeconds: 29 }),
    validInput({ intervalSeconds: 86401 }),
    validInput({ uptimeSeconds: 1.5 }),
    validInput({ diskTotalBytes: 10, diskFreeBytes: 11 }),
    validInput({ memoryTotalBytes: 10, memoryUsedBytes: 11 }),
    validInput({ memoryTotalBytes: 10, memoryFreeBytes: 11 }),
    validInput({ inventoryDetails: [] }),
    validInput({ inventoryDetails: "texto" }),
    validInput({ inventoryDetails: { grande: "x".repeat(1024 * 1024 + 1) } })
  ];
  for (const input of invalid) {
    assert.throws(() => validateAgentPayload(input), (error) => error.statusCode === 400, JSON.stringify(input)?.slice(0, 60));
  }

  const circular = {};
  circular.self = circular;
  assert.throws(() => validateAgentPayload(validInput({ inventoryDetails: circular })), (error) => error.statusCode === 400);
});

test("aceita limites exatos de memoria e disco", () => {
  const payload = validateAgentPayload(validInput({
    diskTotalBytes: 10,
    diskFreeBytes: 10,
    memoryTotalBytes: 8,
    memoryUsedBytes: 8,
    memoryFreeBytes: 8,
    cpuUsagePercent: 100,
    intervalSeconds: 30
  }));
  assert.equal(payload.diskFreeBytes, 10);
  assert.equal(payload.intervalSeconds, 30);
});

test("nome do enrollment e obrigatorio e limitado a 120 caracteres", () => {
  assert.equal(validateEnrollmentName("  Laboratorio  "), "Laboratorio");
  assert.throws(() => validateEnrollmentName(""), (error) => error.statusCode === 400);
  assert.throws(() => validateEnrollmentName(undefined), (error) => error.statusCode === 400);
  assert.throws(() => validateEnrollmentName("x".repeat(121)), (error) => error.statusCode === 400);
});

test("resultado do trabalho valida corpo, codigo de saida e tamanhos", () => {
  const ok = validateJobResultPayload({
    jobId: " job-1 ",
    body: { exitCode: 0, timedOut: true, stdout: "a", stderr: "b", errorMessage: "c" }
  });
  assert.deepEqual(ok, {
    jobId: "job-1",
    result: { exitCode: 0, timedOut: true, stdout: "a", stderr: "b", errorMessage: "c" }
  });

  const defaults = validateJobResultPayload({ jobId: "j", body: {} });
  assert.deepEqual(defaults.result, { exitCode: null, timedOut: false, stdout: "", stderr: "", errorMessage: "" });
  assert.equal(validateJobResultPayload({ jobId: "j", body: { exitCode: "7", timedOut: "true" } }).result.exitCode, 7);
  assert.equal(validateJobResultPayload({ jobId: "j", body: { exitCode: "7", timedOut: "true" } }).result.timedOut, false);
  assert.equal(validateJobResultPayload({ jobId: "j", body: { exitCode: -2147483648 } }).result.exitCode, -2147483648);

  const invalid = [
    { jobId: "j", body: null },
    { jobId: "j", body: [] },
    { jobId: "j", body: "x" },
    { jobId: "j", body: { exitCode: "abc" } },
    { jobId: "j", body: { exitCode: 2147483648 } },
    { jobId: "j", body: { exitCode: 1.5 } },
    { jobId: "j", body: { stdout: "x".repeat(65537) } },
    { jobId: "j", body: { stderr: "x".repeat(65537) } },
    { jobId: "j", body: { errorMessage: "x".repeat(4001) } },
    { jobId: "", body: {} },
    { jobId: "j".repeat(181), body: {} }
  ];
  for (const input of invalid) {
    assert.throws(() => validateJobResultPayload(input), (error) => error.statusCode === 400, JSON.stringify(input).slice(0, 60));
  }
});

test("comparacao de versoes numericas", () => {
  assert.ok(compareVersions("1.10.0", "1.9.0") > 0);
  assert.ok(compareVersions("1.0", "1.0.1") < 0);
  assert.equal(compareVersions("1.0", "1.0.0"), 0);
  assert.equal(compareVersions(undefined, "0"), 0);
  assert.ok(compareVersions("2", "1.99.99") > 0);
  assert.ok(compareVersions("1.x.0", "1.1.0") < 0, "segmento nao numerico conta como zero");

  assert.equal(isUpdateAvailable("2.0.0", "1.0.0"), true);
  assert.equal(isUpdateAvailable("1.0.0", "1.0.0"), false);
  assert.equal(isUpdateAvailable("", "1.0.0"), false);
  assert.equal(isUpdateAvailable("2.0.0", ""), false);
  assert.equal(isUpdateAvailable(null, null), false);
});
