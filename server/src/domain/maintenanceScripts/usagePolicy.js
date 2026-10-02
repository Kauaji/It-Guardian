import { badRequest, conflict, notFoundError } from "../../lib/errors.js";
import { resolveScriptRiskLevel } from "./scriptVocabulary.js";

/**
 * Regras de uso de um script cadastrado a partir de uma sugestao de OS, de uma
 * Ordem de Servico ou de uma simulacao: pre-condicoes, confirmacao de risco,
 * janela de observacao e desfecho da observacao. Modulo puro.
 */

export const SUGGESTION_STATUSES_ACCEPTING_SCRIPTS = [
  "pending",
  "observed_persistent",
  "insufficient_data",
  "validation_cancelled"
];

const MIN_VALIDATION_WINDOW_MINUTES = 5;
const MAX_VALIDATION_WINDOW_MINUTES = 10080;
const DEFAULT_VALIDATION_WINDOW_MINUTES = 30;

export const HIGH_RISK_USAGE_MESSAGE =
  "Scripts de alto risco exigem confirmação extra antes de registrar o uso.";

export const QUEUED_LOG_PARSED_SUMMARY =
  "Script enfileirado. O agente da máquina enviará o resultado após a execução.";

const QUEUED_LOG_ORIGINS = {
  suggestion: "Execução solicitada a partir de sugestão de OS.",
  serviceOrder: "Execução solicitada a partir de uma Ordem de Serviço."
};

export function assertSuggestionAcceptsScripts(suggestion) {
  if (!SUGGESTION_STATUSES_ACCEPTING_SCRIPTS.includes(suggestion.status)) {
    throw conflict("Apenas sugestões pendentes podem receber observação de script.");
  }
}

export function assertScriptAvailable(script) {
  if (!script || script.active === false) {
    throw notFoundError("Script de manutenção não encontrado ou inativo.");
  }
}

export function assertExecutionConfirmed(payload) {
  if (payload.confirmed !== true) {
    throw badRequest("Confirme o envio deste script cadastrado para execução pelo agente da máquina.");
  }
}

export function isHighRiskScript(script) {
  const riskLevel = resolveScriptRiskLevel(script);
  return riskLevel === "high" || riskLevel === "critical";
}

/** Scripts de risco alto ou critico exigem confirmacao extra (riskAcknowledged) alem da confirmacao simples. */
export function assertRiskAcknowledged(script, payload, message) {
  if (isHighRiskScript(script) && payload.riskAcknowledged !== true) {
    throw badRequest(message);
  }
}

/** Janela de observacao em minutos: entre 5 minutos e 7 dias; valor invalido assume o configurado ou 30. */
export function clampValidationWindowMinutes(requested, configured) {
  const configuredMinutes = Number(configured || DEFAULT_VALIDATION_WINDOW_MINUTES);
  const candidate = Number(requested || configured || DEFAULT_VALIDATION_WINDOW_MINUTES);
  const minutes = Number.isNaN(candidate)
    ? (Number.isNaN(configuredMinutes) ? DEFAULT_VALIDATION_WINDOW_MINUTES : configuredMinutes)
    : candidate;
  return Math.min(MAX_VALIDATION_WINDOW_MINUTES, Math.max(MIN_VALIDATION_WINDOW_MINUTES, Math.round(minutes)));
}

/** Texto do log tecnico gravado quando o servidor apenas enfileira o script. */
export function buildQueuedExecutionRawLog(origin) {
  return [
    QUEUED_LOG_ORIGINS[origin],
    "O servidor apenas enfileirou o script cadastrado.",
    "Aguardando o agente autenticado da máquina executar e devolver o resultado."
  ].join("\n");
}

/** Desfecho de uma observacao vencida a partir do estado atual do aviso de origem. */
export function resolveObservationOutcome({ alertId, alertStatus }) {
  if (alertId && alertStatus) {
    if (alertStatus === "resolved") {
      return {
        status: "observed_resolved",
        resultSummary: "O aviso não voltou durante o período de observação. Não existe confirmação de execução do script."
      };
    }
    return {
      status: "observed_persistent",
      resultSummary: "O aviso continuou ativo durante o período de observação. Nenhum comando foi executado nesta versão."
    };
  }
  return {
    status: "insufficient_data",
    resultSummary: "Não há coleta suficiente para concluir a observação. Nenhum comando foi executado."
  };
}
