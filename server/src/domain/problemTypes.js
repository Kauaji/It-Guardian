// Extraido de publicServiceOrderService.js para nao criar um import
// circular quando o checklist tecnico (serviceOrderChecklistService.js)
// precisou resolver a mesma chave de tipo de problema usada aqui pra
// calcular prioridade - os dois lados agora importam deste modulo de
// dominio, sem nenhum dos dois apontar pro outro. A leitura dos tipos de
// problema configurados (banco) fica em services/problemTypeService.js.
import { serviceOrderPriorities } from "./serviceOrders/serviceOrderPriority.js";

/**
 * Tipo de problema (configurado no banco ou padrao embutido).
 * @typedef {object} ProblemType
 * @property {string} id
 * @property {string} name
 * @property {string | null} [description]
 * @property {string} category
 * @property {string} defaultPriority
 */

/**
 * Registro configurado como lido do banco (`active` ausente conta como ativo).
 * @typedef {{ id: string, name: string, description?: string | null, category: string, defaultPriority?: unknown, active?: boolean }} ProblemTypeRecord
 */

/** @type {string[]} */
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

/** @type {ProblemType[]} */
export const defaultProblemTypes = [
  { id: "default-computer-power", name: "Computador nao liga", category: "Computador", defaultPriority: "high" },
  { id: "default-printer", name: "Impressora nao imprime", category: "Impressora", defaultPriority: "medium" },
  { id: "default-network", name: "Internet lenta", category: "Rede", defaultPriority: "medium" },
  { id: "default-system", name: "Sistema travando", category: "Sistema", defaultPriority: "medium" },
  { id: "default-monitor", name: "Monitor sem imagem", category: "Monitor", defaultPriority: "medium" },
  { id: "default-keyboard", name: "Teclado com defeito", category: "Teclado", defaultPriority: "low" },
  { id: "default-mouse", name: "Mouse com defeito", category: "Mouse", defaultPriority: "low" }
];

/** @type {Record<string, number>} Ordem crescente de gravidade (1 a 4). */
const priorityRank = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

/**
 * @param {unknown} value
 * @returns {string}
 */
function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} [value]
 * @returns {string} Texto sem acentos, aparado e em minusculas.
 */
export function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function sanitizePriority(value, fallback = "medium") {
  return typeof value === "string" && serviceOrderPriorities.has(value) ? value : fallback;
}

/**
 * @param {{ category?: unknown }[]} problemTypes
 * @returns {string[]} Categorias configuradas seguidas das padrao, sem repeticao.
 */
export function uniqueCategories(problemTypes) {
  const configuredCategories = problemTypes
    .map((item) => trim(item.category))
    .filter(Boolean);

  return Array.from(new Set([...configuredCategories, ...defaultCategories]));
}

/**
 * @param {string} current
 * @param {unknown} candidate
 * @returns {string} A mais grave (`candidate` invalida mantem `current`).
 */
export function chooseHigherPriority(current, candidate) {
  const safeCandidate = sanitizePriority(candidate, "");
  if (!safeCandidate) return current;
  return priorityRank[safeCandidate] > priorityRank[current] ? safeCandidate : current;
}

/**
 * Tipos de problema ativos a partir dos registros configurados (funcao pura);
 * sem nenhum ativo, usa os padroes embutidos.
 *
 * @param {ProblemTypeRecord[]} configured
 * @returns {ProblemType[]}
 */
export function activeProblemTypesFromRecords(configured) {
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

/**
 * Procura o tipo de problema por id ou nome, ignorando acentos e caixa.
 *
 * @param {{ id: string, name: string }[]} problemTypes
 * @param {unknown} problemTypeValue
 * @returns {string | null} Id do tipo encontrado.
 */
export function findProblemTypeKey(problemTypes, problemTypeValue) {
  const match = problemTypes.find(
    (item) => normalize(item.id) === normalize(problemTypeValue) || normalize(item.name) === normalize(problemTypeValue)
  );
  return match ? match.id : null;
}
