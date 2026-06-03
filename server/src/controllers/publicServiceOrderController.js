import {
  createServiceOrder,
  serviceOrderPriorities
} from "../repositories/serviceOrderRepository.js";
import { listSettingsRecords } from "../repositories/settingsRepository.js";
import { getSystemSettings } from "../repositories/systemSettingsRepository.js";

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

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function sanitizePriority(value, fallback = "medium") {
  return serviceOrderPriorities.has(value) ? value : fallback;
}

function uniqueCategories(problemTypes) {
  const configuredCategories = problemTypes
    .map((item) => trim(item.category))
    .filter(Boolean);

  return Array.from(new Set([...configuredCategories, ...defaultCategories]));
}

function chooseHigherPriority(current, candidate) {
  const safeCandidate = sanitizePriority(candidate, "");
  if (!safeCandidate) return current;
  return priorityRank[safeCandidate] > priorityRank[current] ? safeCandidate : current;
}

async function getActiveProblemTypes() {
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

export async function supportOptions(_req, res, next) {
  try {
    const systemSettings = await getSystemSettings();
    const problemTypes = await getActiveProblemTypes();

    res.json({
      categories: uniqueCategories(problemTypes),
      problemTypes,
      systemMode: systemSettings.systemMode
    });
  } catch (error) {
    next(error);
  }
}

export async function createPublicServiceOrder(req, res, next) {
  try {
    const title = trim(req.body.title);
    const description = trim(req.body.description);
    const category = trim(req.body.category);
    const requesterName = trim(req.body.requesterName);
    const problemType = trim(req.body.problemType);
    const systemSettings = await getSystemSettings();
    const businessMode = systemSettings.systemMode === "business";
    const contactInfo = businessMode ? trim(req.body.contactInfo) : "";
    const extension = businessMode ? "" : trim(req.body.extension);

    if (title.length < 3) {
      return res.status(400).json({ message: "Informe um título com pelo menos 3 caracteres." });
    }

    if (description.length < 5) {
      return res.status(400).json({ message: "Descreva o problema com um pouco mais de detalhe." });
    }

    if (!category) {
      return res.status(400).json({ message: "Selecione uma categoria." });
    }

    if (!requesterName) {
      return res.status(400).json({ message: "Informe o nome do solicitante." });
    }

    if (!problemType) {
      return res.status(400).json({ message: "Selecione o tipo de problema." });
    }

    if (businessMode && !contactInfo) {
      return res.status(400).json({ message: "Informe um contato para abrir o chamado." });
    }

    const environmentName = trim(req.body.environmentName) || "Não identificado";
    const machineScope = trim(req.body.machineScope) || "mine";
    const relatedAssetText = trim(req.body.relatedAssetText);
    const accessInfo = [
      trim(req.body.machineName) ? `AnyDesk: ${trim(req.body.machineName)}` : "",
      trim(req.body.assetTag) ? `VNC: ${trim(req.body.assetTag)}` : "",
      trim(req.body.location) ? `TeamViewer: ${trim(req.body.location)}` : ""
    ].filter(Boolean).join(" | ");
    const relatedAssetInfo = relatedAssetText || accessInfo;
    const priority = await calculatePriority({ category, problemType, environmentName });

    const notes = [
      "Origem: formulário público/atalho do usuário",
      trim(req.body.department) ? `Setor: ${trim(req.body.department)}` : "",
      extension ? `Ramal: ${extension}` : "",
      relatedAssetInfo ? `Acessos informados: ${relatedAssetInfo}` : "",
      trim(req.body.machineNotes) ? `Observação do equipamento: ${trim(req.body.machineNotes)}` : ""
    ].filter(Boolean).join("\n");

    const serviceOrder = await createServiceOrder({
      payload: {
        title,
        description,
        priority,
        category,
        problemType,
        assetId: trim(req.body.assetId) || null,
        environmentName,
        requesterName,
        contactInfo: contactInfo || null,
        requesterDepartment: trim(req.body.department) || null,
        requesterExtension: extension || null,
        relatedAssetText: relatedAssetInfo || null,
        machineScope,
        location: trim(req.body.location) || null,
        source: "public_support_form",
        notes
      },
      user: { name: "Formulário público" }
    });

    res.status(201).json({
      serviceOrder: {
        number: serviceOrder.number,
        createdAt: serviceOrder.createdAt,
        priority: serviceOrder.priority,
        status: serviceOrder.status
      }
    });
  } catch (error) {
    next(error);
  }
}
