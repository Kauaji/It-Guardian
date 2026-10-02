import { createHash } from "node:crypto";
import { forbidden } from "../lib/errors.js";

/**
 * Regras puras da fila de scripts do agente: quais tipos sao executaveis,
 * controle duplo para risco alto, limites de timeout/saida, integridade do
 * conteudo por hash e classificacao do resultado devolvido pelo agente.
 * Nenhuma funcao aqui acessa banco, rede ou o ambiente.
 */

export const executableTypes = new Set(["bat", "cmd", "powershell"]);
export const dualControlRiskLevels = new Set(["high", "critical"]);
export const terminalJobStatuses = new Set(["succeeded", "failed", "timed_out"]);
export const maxOutputLength = 65536;

export const TAMPERED_JOB_SUMMARY =
  "Execucao recusada: o conteudo do script cadastrado mudou (ou foi desativado) " +
  "depois que este trabalho foi enfileirado. Nenhum comando foi enviado ao agente.";

export const ROLLUP_FAILURE_SUMMARY = "Uma ou mais verificações terminaram com falha no agente.";
export const ROLLUP_SUCCESS_SUMMARY = "Todas as verificações foram executadas com sucesso pelo agente.";

export function hashScriptContent(content) {
  return createHash("sha256").update(String(content || ""), "utf8").digest("hex");
}

export function isExecutableScriptType(type) {
  return executableTypes.has(String(type || "").toLowerCase());
}

/** Scripts de risco alto ou critico exigem uma segunda pessoa alem de quem editou o conteudo. */
export function requiresSecondReviewer(riskLevel) {
  return dualControlRiskLevels.has(String(riskLevel || "").toLowerCase());
}

export function assertSecondReviewer(script, userId) {
  if (!userId || !script.contentUpdatedBy) return;
  if (!requiresSecondReviewer(script.riskLevel)) return;
  if (userId !== script.contentUpdatedBy) return;

  throw forbidden(
    "Scripts de risco alto ou critico nao podem ser enfileirados pela mesma pessoa que cadastrou " +
      "ou editou o conteudo por ultimo. Peca para outro usuario com permissao revisar e enviar.",
    { code: "SCRIPT_EXECUTION_REQUIRES_SECOND_REVIEWER" }
  );
}

/** Timeout do trabalho entre 15 e 600 segundos; valor ausente ou nao numerico assume 120. */
export function clampTimeoutSeconds(value) {
  const requested = Number(value || 120);
  const seconds = Number.isNaN(requested) ? 120 : requested;
  return Math.min(600, Math.max(15, Math.round(seconds)));
}

export function truncateOutput(value) {
  return String(value || "").slice(0, maxOutputLength);
}

/**
 * O conteudo cadastrado e a lista fechada de scripts aprovados: um trabalho so
 * pode ser entregue se o script continua ativo e o hash gravado no
 * enfileiramento ainda bate com o conteudo vigente.
 */
export function isJobContentStillApproved({ scriptActive, currentContent, expectedHash }) {
  return scriptActive === true && hashScriptContent(currentContent) === expectedHash;
}

function summarizeJobStatus(status, scriptName) {
  if (status === "succeeded") return `Script '${scriptName}' executado com sucesso pelo agente.`;
  if (status === "timed_out") return `Script '${scriptName}' interrompido por tempo limite.`;
  return `Script '${scriptName}' terminou com falha.`;
}

/**
 * Classifica o resultado reportado pelo agente: sucesso so com exit code 0 e
 * sem mensagem de erro; tempo limite tem precedencia; o resto e falha.
 */
export function evaluateJobResult(result, scriptName) {
  const timedOut = result.timedOut === true;
  const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : null;
  const errorMessage = truncateOutput(result.errorMessage);
  const status = timedOut ? "timed_out" : exitCode === 0 && !errorMessage ? "succeeded" : "failed";
  const stdout = truncateOutput(result.stdout);
  const stderr = truncateOutput(result.stderr);
  const rawLog = [
    stdout ? `STDOUT:\n${stdout}` : "",
    stderr ? `STDERR:\n${stderr}` : "",
    errorMessage ? `ERRO:\n${errorMessage}` : ""
  ].filter(Boolean).join("\n\n");

  return {
    status,
    exitCode,
    timedOut,
    stdout,
    stderr,
    errorMessage,
    rawLog,
    summary: summarizeJobStatus(status, scriptName)
  };
}

/** Estado final da validacao de aviso vinculada ao trabalho concluido. */
export function validationStatusForJob(jobStatus) {
  return jobStatus === "succeeded" ? "execution_success" : "execution_failed";
}
