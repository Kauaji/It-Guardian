/**
 * Vocabulario fechado do dominio de scripts de manutencao: tipos, niveis de
 * risco, modos de simulacao, estados de validacao, variaveis permitidas e
 * limites de tamanho. Modulo puro (sem acesso a banco).
 */

export const scriptTypes = new Set(["bat", "cmd", "powershell", "shell", "other"]);
export const riskLevels = new Set(["low", "medium", "high", "critical"]);
export const simulationModes = new Set(["simulated", "prepared", "agent"]);
export const validationStatuses = new Set([
  "waiting_agent",
  "prepared",
  "observation_pending",
  "observed_resolved",
  "observed_persistent",
  "execution_confirmed",
  "execution_success",
  "execution_failed",
  "validation_cancelled",
  "insufficient_data",
  // Compatibilidade com registros antigos.
  "pending_validation",
  "validation_success",
  "validation_failed"
]);
export const allowedScriptVariables = new Map([
  ["CURRENT_USER", "Usuário logado na máquina atendida"],
  ["USER_PROFILE", "Caminho do perfil do usuário logado"],
  ["TEMP_DIR", "Pasta temporária do usuário"],
  ["HOSTNAME", "Nome da máquina"],
  ["ASSET_NAME", "Nome do ativo no IT Guardian"],
  ["ASSET_IP", "IP do ativo no IT Guardian"],
  ["OS_DRIVE", "Unidade do sistema operacional"],
  ["PROGRAM_DATA", "Pasta ProgramData do Windows"]
]);

export const maxLengths = {
  name: 120,
  description: 500,
  content: 10000,
  category: 80,
  alertType: 80,
  problemType: 120,
  notes: 1000,
  listItem: 80
};

export function normalizeScriptType(value) {
  const type = String(value || "other").trim().toLowerCase();
  return scriptTypes.has(type) ? type : "other";
}

export function normalizeRiskLevel(value, fallback = "medium") {
  const risk = String(value || fallback).trim().toLowerCase();
  return riskLevels.has(risk) ? risk : fallback;
}

/** Nivel de risco efetivo de um script: o cadastrado, senao o sugerido, senao "medium". */
export function resolveScriptRiskLevel(script) {
  return normalizeRiskLevel(script.riskLevel || script.suggestedRiskLevel, "medium");
}
