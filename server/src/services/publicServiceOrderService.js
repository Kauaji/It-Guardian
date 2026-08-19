import { findAgentAssetByActivationId } from "../repositories/agentRepository.js";
import { startMaintenanceForAsset } from "../repositories/assetLifecycleRepository.js";
import {
  createServiceOrder,
  serviceOrderPriorities
} from "../repositories/serviceOrderRepository.js";
import { listSettingsRecords } from "../repositories/settingsRepository.js";
import { getSystemSettings } from "../repositories/systemSettingsRepository.js";
import { verifyPublicMachineToken } from "../domain/publicMachineToken.js";
import { badRequest, notFoundError } from "../lib/errors.js";

const defaultCategories = [
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

const defaultProblemTypes = [
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

async function calculatePriority({ category, problemType, environmentName }) {
  const problemTypes = await getActiveProblemTypes();
  const selectedProblemType = problemTypes.find(
    (item) => normalize(item.id) === normalize(problemType) || normalize(item.name) === normalize(problemType)
  );
  let priority = sanitizePriority(selectedProblemType?.defaultPriority, "medium");

  const rules = await listSettingsRecords("priorityRules");
  for (const rule of rules.filter((item) => item.active !== false)) {
    const target = normalize(rule.targetValue);
    if (!target) continue;

    const matches =
      (rule.ruleType === "problem_type" &&
        [selectedProblemType?.id, selectedProblemType?.name, problemType].some((value) => normalize(value) === target)) ||
      (rule.ruleType === "equipment_category" && normalize(category) === target) ||
      (rule.ruleType === "client" && normalize(environmentName) === target);

    if (matches) {
      priority = chooseHigherPriority(priority, rule.priority);
    }
  }

  return priority;
}

// Reaproveitada pelo checklist tecnico (serviceOrderChecklistService.js)
// pra resolver `service_orders.problem_type` (texto livre - pode ser o id
// de um problem_types configurado, o nome, ou um slug default-* quando
// nao ha nenhum problem type configurado) na mesma chave usada por
// `calculatePriority` - evita as duas logicas de match divergirem.
export async function resolveProblemTypeKey(problemTypeValue) {
  const problemTypes = await getActiveProblemTypes();
  const match = problemTypes.find(
    (item) => normalize(item.id) === normalize(problemTypeValue) || normalize(item.name) === normalize(problemTypeValue)
  );
  return match ? match.id : null;
}

export async function getSupportOptions() {
  const systemSettings = await getSystemSettings();
  const problemTypes = await getActiveProblemTypes();

  return {
    categories: uniqueCategories(problemTypes),
    problemTypes,
    systemMode: systemSettings.systemMode
  };
}

async function resolveMachineFromToken(token) {
  const activationId = verifyPublicMachineToken(trim(token));
  if (!activationId) return null;
  return findAgentAssetByActivationId(activationId);
}

export async function getPublicMachineContext(deviceToken) {
  const asset = await resolveMachineFromToken(deviceToken);
  if (!asset) throw notFoundError("Maquina do instalador nao identificada.");

  return {
    id: asset.id,
    name: asset.machineAlias || asset.hostname,
    hostname: asset.hostname,
    environmentName: asset.environment || "Nao identificado"
  };
}

export async function submitPublicServiceOrder(body) {
  const title = trim(body.title);
  const description = trim(body.description);
  const category = trim(body.category);
  const requesterName = trim(body.requesterName);
  const problemType = trim(body.problemType);
  const systemSettings = await getSystemSettings();
  const businessMode = systemSettings.systemMode === "business";
  const contactInfo = businessMode ? trim(body.contactInfo) : "";
  const extension = businessMode ? "" : trim(body.extension);

  if (title.length < 3) {
    throw badRequest("Informe um título com pelo menos 3 caracteres.");
  }

  if (description.length < 5) {
    throw badRequest("Descreva o problema com um pouco mais de detalhe.");
  }

  if (!category) {
    throw badRequest("Selecione uma categoria.");
  }

  if (!requesterName) {
    throw badRequest("Informe o nome do solicitante.");
  }

  if (!problemType) {
    throw badRequest("Selecione o tipo de problema.");
  }

  if (businessMode && !contactInfo) {
    throw badRequest("Informe um contato para abrir o chamado.");
  }

  const machineScope = trim(body.machineScope) || "mine";
  const installedMachine = machineScope === "mine"
    ? await resolveMachineFromToken(body.deviceToken)
    : null;
  if (machineScope === "mine" && trim(body.deviceToken) && !installedMachine) {
    throw badRequest("Nao foi possivel identificar esta maquina pelo instalador.");
  }
  const environmentName = installedMachine?.environment || trim(body.environmentName) || "Não identificado";
  const relatedAssetText = trim(body.relatedAssetText);
  const accessInfo = [
    trim(body.machineName) ? `AnyDesk: ${trim(body.machineName)}` : "",
    trim(body.assetTag) ? `VNC: ${trim(body.assetTag)}` : "",
    trim(body.location) ? `TeamViewer: ${trim(body.location)}` : ""
  ].filter(Boolean).join(" | ");
  const relatedAssetInfo = relatedAssetText || accessInfo;
  const priority = await calculatePriority({ category, problemType, environmentName });

  const notes = [
    "Origem: formulário público/atalho do usuário",
    trim(body.department) ? `Setor: ${trim(body.department)}` : "",
    extension ? `Ramal: ${extension}` : "",
    relatedAssetInfo ? `Acessos informados: ${relatedAssetInfo}` : "",
    trim(body.machineNotes) ? `Observação do equipamento: ${trim(body.machineNotes)}` : ""
  ].filter(Boolean).join("\n");

  const serviceOrder = await createServiceOrder({
    payload: {
      title,
      description,
      priority,
      category,
      problemType,
      assetId: installedMachine?.id || (machineScope === "other" ? trim(body.assetId) : null) || null,
      environmentName,
      requesterName,
      contactInfo: contactInfo || null,
      requesterDepartment: trim(body.department) || null,
      requesterExtension: extension || null,
      relatedAssetText: relatedAssetInfo || null,
      machineScope,
      location: trim(body.location) || null,
      source: "public_support_form",
      notes
    },
    user: { name: "Formulário público" }
  });

  if (serviceOrder.assetId) {
    try {
      await startMaintenanceForAsset({
        assetId: serviceOrder.assetId,
        serviceOrderId: serviceOrder.id,
        notes: "Manutencao iniciada por chamado publico vinculado a maquina.",
        user: { name: "Formulário público" }
      });
    } catch (error) {
      if (error.statusCode !== 409) throw error;
    }
  }

  return {
    number: serviceOrder.number,
    createdAt: serviceOrder.createdAt,
    priority: serviceOrder.priority,
    status: serviceOrder.status
  };
}
