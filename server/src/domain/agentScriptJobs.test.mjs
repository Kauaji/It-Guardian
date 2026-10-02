import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  assertSecondReviewer,
  clampTimeoutSeconds,
  evaluateJobResult,
  hashScriptContent,
  isExecutableScriptType,
  isJobContentStillApproved,
  requiresSecondReviewer,
  truncateOutput,
  validationStatusForJob
} from "./agentScriptJobs.js";

test("hash do conteudo e SHA-256 hexadecimal estavel", () => {
  assert.equal(hashScriptContent("abc"), createHash("sha256").update("abc").digest("hex"));
  assert.equal(hashScriptContent(null), hashScriptContent(""));
  assert.notEqual(hashScriptContent("a"), hashScriptContent("A"));
});

test("somente BAT, CMD e PowerShell sao tipos executaveis", () => {
  for (const type of ["bat", "CMD", "PowerShell"]) assert.equal(isExecutableScriptType(type), true, type);
  for (const type of ["shell", "other", "", null, undefined, "exe"]) assert.equal(isExecutableScriptType(type), false, String(type));
});

test("timeout fica entre 15 e 600 segundos e valores nao numericos assumem 120", () => {
  assert.equal(clampTimeoutSeconds(undefined), 120);
  assert.equal(clampTimeoutSeconds(0), 120);
  assert.equal(clampTimeoutSeconds("abc"), 120);
  assert.equal(clampTimeoutSeconds(1), 15);
  assert.equal(clampTimeoutSeconds(-50), 15);
  assert.equal(clampTimeoutSeconds(300.6), 301);
  assert.equal(clampTimeoutSeconds("90"), 90);
  assert.equal(clampTimeoutSeconds(100000), 600);
  assert.equal(clampTimeoutSeconds(Infinity), 600);
});

test("saida e truncada em 64 KiB", () => {
  assert.equal(truncateOutput("x".repeat(70000)).length, 65536);
  assert.equal(truncateOutput(undefined), "");
  assert.equal(truncateOutput(42), "42");
});

test("controle duplo vale para risco alto e critico e compara a identidade do ultimo editor", () => {
  assert.equal(requiresSecondReviewer("high"), true);
  assert.equal(requiresSecondReviewer("CRITICAL"), true);
  assert.equal(requiresSecondReviewer("medium"), false);
  assert.equal(requiresSecondReviewer(undefined), false);

  const critical = { riskLevel: "critical", contentUpdatedBy: "user-1" };
  assert.throws(
    () => assertSecondReviewer(critical, "user-1"),
    (error) => error.statusCode === 403 && error.code === "SCRIPT_EXECUTION_REQUIRES_SECOND_REVIEWER"
  );
  assert.doesNotThrow(() => assertSecondReviewer(critical, "user-2"));
  assert.doesNotThrow(() => assertSecondReviewer(critical, null), "sem usuario nao ha identidade para comparar");
  assert.doesNotThrow(() => assertSecondReviewer({ riskLevel: "critical", contentUpdatedBy: null }, "user-1"));
  assert.doesNotThrow(() => assertSecondReviewer({ riskLevel: "low", contentUpdatedBy: "user-1" }, "user-1"));
});

test("conteudo so continua aprovado se o script esta ativo e o hash bate", () => {
  const expectedHash = hashScriptContent("Get-Service");
  assert.equal(isJobContentStillApproved({ scriptActive: true, currentContent: "Get-Service", expectedHash }), true);
  assert.equal(isJobContentStillApproved({ scriptActive: true, currentContent: "Get-Service ", expectedHash }), false);
  assert.equal(isJobContentStillApproved({ scriptActive: false, currentContent: "Get-Service", expectedHash }), false);
  assert.equal(isJobContentStillApproved({ scriptActive: undefined, currentContent: "Get-Service", expectedHash }), false);
});

test("classifica o resultado do agente e monta o log tecnico", () => {
  const success = evaluateJobResult({ exitCode: 0, stdout: "ok" }, "Diagnostico");
  assert.equal(success.status, "succeeded");
  assert.equal(success.summary, "Script 'Diagnostico' executado com sucesso pelo agente.");
  assert.equal(success.rawLog, "STDOUT:\nok");
  assert.equal(success.timedOut, false);

  assert.equal(evaluateJobResult({ exitCode: 1 }, "x").status, "failed");
  assert.equal(evaluateJobResult({ exitCode: "0" }, "x").status, "failed", "codigo nao inteiro vira nulo e falha");
  assert.equal(evaluateJobResult({ exitCode: "0" }, "x").exitCode, null);
  assert.equal(evaluateJobResult({ exitCode: 0, errorMessage: "boom" }, "x").status, "failed");

  const timeout = evaluateJobResult({ exitCode: 0, timedOut: true, stdout: "a", stderr: "b", errorMessage: "c" }, "Lento");
  assert.equal(timeout.status, "timed_out");
  assert.equal(timeout.summary, "Script 'Lento' interrompido por tempo limite.");
  assert.equal(timeout.rawLog, "STDOUT:\na\n\nSTDERR:\nb\n\nERRO:\nc");

  const failed = evaluateJobResult({ exitCode: 2 }, "Falha");
  assert.equal(failed.summary, "Script 'Falha' terminou com falha.");
  assert.equal(failed.rawLog, "");
  assert.equal(evaluateJobResult({ exitCode: 0, timedOut: "true" }, "x").timedOut, false, "somente true booleano conta como tempo limite");
});

test("estado da validacao acompanha o resultado do trabalho", () => {
  assert.equal(validationStatusForJob("succeeded"), "execution_success");
  assert.equal(validationStatusForJob("failed"), "execution_failed");
  assert.equal(validationStatusForJob("timed_out"), "execution_failed");
});
