// Extraido de publicServiceOrderService.js para nao criar um import
// circular quando o checklist tecnico (serviceOrderChecklistService.js)
// precisou resolver a mesma chave de tipo de problema usada aqui pra
// calcular prioridade - os dois lados agora importam deste modulo de
// dominio, sem nenhum dos dois apontar pro outro.
import { serviceOrderPriorities } from "../repositories/serviceOrderRepository.js";
import { listSettingsRecords } from "../repositories/settingsRepository.js";

export const defaultCategories = [
  "Computador",
  "Notebook",
  "Servidor",
  "Impressora",
  "Teclado",
  "Mouse",
  "Monitor",
  "Rede",
  "Sistema",
  "Outro"
];

export const defaultProblemTypes = [
  { id: "default-computer-power", name: "Computador nao liga", category: "Computador", defaultPriority: "high" },
  { id: "default-printer", name: "Impressora nao imprime", category: "Impressora", defaultPriority: "medium" },
  { id: "default-network", name: "Internet lenta", category: "Rede", defaultPriority: "medium" },
  { id: "default-system", name: "Sistema travando", category: "Sistema", defaultPriority: "medium" },
  { id: "default-monitor", name: "Monitor sem imagem", category: "Monitor", defaultPriority: "medium" },
  { id: "default-keyboard", name: "Teclado com defeito", category: "Teclado", defaultPriority: "low" },
  { id: "default-mouse", name: "Mouse com defeito", category: "Mouse", defaultPriority: "low" }
];

const priorityRank = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function sanitizePriority(value, fallback = "medium") {
  return serviceOrderPriorities.has(value) ? value : fallback;
}

export function uniqueCategories(problemTypes) {
  const configuredCategories = problemTypes
    .map((item) => trim(item.category))
    .filter(Boolean);

  return Array.from(new Set([...configuredCategories, ...defaultCategories]));
}

export function chooseHigherPriority(current, candidate) {
  const safeCandidate = sanitizePriority(candidate, "");
  if (!safeCandidate) return current;
  return priorityRank[safeCandidate] > priorityRank[current] ? safeCandidate : current;
}

export async function getActiveProblemTypes() {
  const configured = await listSettingsRecords("problemTypes");
  const active = configured
    .filter((item) => item.active !== false)
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      defaultPriority: sanitizePriority(item.defaultPriority, "medium")
    }));

  return active.length ? active : defaultProblemTypes;
}

// Reaproveitada pelo checklist tecnico (serviceOrderChecklistService.js) e
// pelo calculo de prioridade do formulario publico para resolver
// `service_orders.problem_type` (texto livre - pode ser o id de um
// problem_types configurado, o nome, ou um slug default-* quando nao ha
// nenhum problem type configurado) na mesma chave - evita as duas logicas
// de match divergirem.
export async function resolveProblemTypeKey(problemTypeValue) {
  const problemTypes = await getActiveProblemTypes();
  const match = problemTypes.find(
    (item) => normalize(item.id) === normalize(problemTypeValue) || normalize(item.name) === normalize(problemTypeValue)
  );
  return match ? match.id : null;
}
