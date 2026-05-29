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

    res.json({
      categories: defaultCategories,
      problemTypes: await getActiveProblemTypes(),
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

    if (title.length < 3) {
      return res.status(400).json({ message: "Informe um titulo com pelo menos 3 caracteres." });
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

    const environmentName = trim(req.body.environmentName) || "Nao identificado";
    const machineScope = trim(req.body.machineScope) || "mine";
    const relatedAssetText = trim(req.body.relatedAssetText);
    const priority = await calculatePriority({ category, problemType, environmentName });

    const notes = [
      "Origem: formulario publico/atalho do usuario",
      trim(req.body.department) ? `Setor: ${trim(req.body.department)}` : "",
      trim(req.body.extension) ? `Ramal: ${trim(req.body.extension)}` : "",
      trim(req.body.location) ? `Localizacao: ${trim(req.body.location)}` : "",
      relatedAssetText ? `Maquina/equipamento informado: ${relatedAssetText}` : "",
      trim(req.body.machineNotes) ? `Observacao do equipamento: ${trim(req.body.machineNotes)}` : ""
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
        contactInfo: trim(req.body.contactInfo) || null,
        requesterDepartment: trim(req.body.department) || null,
        requesterExtension: trim(req.body.extension) || null,
        relatedAssetText: relatedAssetText || null,
        machineScope,
        location: trim(req.body.location) || null,
        source: "public_support_form",
        notes
      },
      user: { name: "Formulario publico" }
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
