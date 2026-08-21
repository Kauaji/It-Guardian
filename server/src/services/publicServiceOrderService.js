import { findAgentAssetByActivationId } from "../repositories/agentRepository.js";
import { startMaintenanceForAsset } from "../repositories/assetLifecycleRepository.js";
import {
  createServiceOrder,
  calculateServiceOrderSla,
  findServiceOrderById,
  formatServiceOrderNumber,
  getServiceOrderSettings
} from "../repositories/serviceOrderRepository.js";
import { listSettingsRecords } from "../repositories/settingsRepository.js";
import { getSystemSettings } from "../repositories/systemSettingsRepository.js";
import { verifyPublicMachineToken } from "../domain/publicMachineToken.js";
import {
  createPublicServiceOrderTrackingToken,
  verifyPublicServiceOrderTrackingToken
} from "../domain/publicServiceOrderTrackingToken.js";
import {
  chooseHigherPriority,
  getActiveProblemTypes,
  normalize,
  resolveProblemTypeKey,
  sanitizePriority,
  uniqueCategories
} from "../domain/problemTypes.js";
import { applyChecklistTemplateOnCreate } from "./serviceOrderChecklistService.js";
import { trimString } from "../lib/textUtils.js";
import { badRequest, notFoundError } from "../lib/errors.js";

// Reexportados porque publicServiceOrderService.test.mjs e outros
// consumidores ja importam essas funcoes puras daqui - moveram de
// implementacao (agora vivem em domain/problemTypes.js) sem mudar de onde
// sao importadas.
export { normalize, sanitizePriority, uniqueCategories, chooseHigherPriority, resolveProblemTypeKey };

const maxLengths = {
  title: 200,
  description: 4000,
  category: 120,
  requesterName: 150,
  problemType: 200,
  contactInfo: 150,
  department: 120,
  extension: 20,
  relatedAssetText: 500,
  machineName: 150,
  assetTag: 120,
  location: 200,
  machineNotes: 1000,
  environmentName: 150
};

// Nome de um campo que nunca deve ser preenchido por um usuario real - so
// bots que preenchem todo input do formulario (inclusive os escondidos por
// CSS) tendem a preencher. Ver submitPublicServiceOrder: se vier
// preenchido, retornamos sucesso (mesmo formato de uma OS real) sem gravar
// nada, pra nao dar sinal nenhum ao bot sobre qual campo o denunciou.
export const honeypotFieldName = "website";

function trim(value, maxLength = 1000) {
  return trimString(value, maxLength, "");
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
  const activationId = verifyPublicMachineToken(trim(token, 2000));
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

// Nunca consulta o banco (nextServiceOrderNumber faz COUNT + lock reais) -
// so precisa "parecer" um numero real pro bot nao ter sinal nenhum de que
// caiu num honeypot, sem gastar uma numeracao de verdade.
async function buildFakeSuccessResponse() {
  const settings = await getServiceOrderSettings();
  const fakeSequence = 100000 + (Date.now() % 900000);
  return {
    number: formatServiceOrderNumber(fakeSequence, settings),
    createdAt: new Date().toISOString(),
    priority: "medium",
    status: settings.statuses?.find((item) => item.isInitial)?.id || "open"
  };
}

export async function submitPublicServiceOrder(body) {
  if (trim(body?.[honeypotFieldName], 2000)) {
    return buildFakeSuccessResponse();
  }

  const title = trim(body.title, maxLengths.title);
  const description = trim(body.description, maxLengths.description);
  const category = trim(body.category, maxLengths.category);
  const requesterName = trim(body.requesterName, maxLengths.requesterName);
  const problemType = trim(body.problemType, maxLengths.problemType);
  const systemSettings = await getSystemSettings();
  const businessMode = systemSettings.systemMode === "business";
  const contactInfo = businessMode ? trim(body.contactInfo, maxLengths.contactInfo) : "";
  const extension = businessMode ? "" : trim(body.extension, maxLengths.extension);

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

  const machineScope = trim(body.machineScope, 20) || "mine";
  const installedMachine = machineScope === "mine"
    ? await resolveMachineFromToken(body.deviceToken)
    : null;
  if (machineScope === "mine" && trim(body.deviceToken, 2000) && !installedMachine) {
    throw badRequest("Nao foi possivel identificar esta maquina pelo instalador.");
  }
  const environmentName = installedMachine?.environment || trim(body.environmentName, maxLengths.environmentName) || "Não identificado";
  const relatedAssetText = trim(body.relatedAssetText, maxLengths.relatedAssetText);
  const machineName = trim(body.machineName, maxLengths.machineName);
  const assetTag = trim(body.assetTag, maxLengths.assetTag);
  const location = trim(body.location, maxLengths.location);
  const accessInfo = [
    machineName ? `Nome da máquina: ${machineName}` : "",
    assetTag ? `Patrimônio: ${assetTag}` : "",
    location ? `Localização: ${location}` : ""
  ].filter(Boolean).join(" | ");
  const relatedAssetInfo = relatedAssetText || accessInfo;
  const priority = await calculatePriority({ category, problemType, environmentName });
  const department = trim(body.department, maxLengths.department);
  const machineNotes = trim(body.machineNotes, maxLengths.machineNotes);

  const notes = [
    "Origem: formulário público/atalho do usuário",
    department ? `Setor: ${department}` : "",
    extension ? `Ramal: ${extension}` : "",
    relatedAssetInfo ? `Acessos informados: ${relatedAssetInfo}` : "",
    machineNotes ? `Observação do equipamento: ${machineNotes}` : ""
  ].filter(Boolean).join("\n");

  // assetId so pode vir de um ativo resolvido por token assinado
  // (installedMachine) - nunca de um id bruto enviado pelo cliente, em
  // nenhum dos dois machineScope. Antes desta correcao, machineScope:
  // "other" aceitava um assetId qualquer sem nenhuma verificacao, o que
  // permitia qualquer chamador anonimo colocar um ativo arbitrario (se
  // soubesse/adivinhasse o UUID) em manutencao e gravar historico nele.
  const serviceOrder = await createServiceOrder({
    payload: {
      title,
      description,
      priority,
      category,
      problemType,
      assetId: installedMachine?.id || null,
      environmentName,
      requesterName,
      contactInfo: contactInfo || null,
      requesterDepartment: department || null,
      requesterExtension: extension || null,
      relatedAssetText: relatedAssetInfo || null,
      machineScope,
      location: location || null,
      source: "public_support_form",
      notes
    },
    user: { name: "Formulário público" }
  });

  await applyChecklistTemplateOnCreate(serviceOrder);

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

  const trackingToken = createPublicServiceOrderTrackingToken(serviceOrder.id);

  return {
    number: serviceOrder.number,
    createdAt: serviceOrder.createdAt,
    priority: serviceOrder.priority,
    status: serviceOrder.status,
    trackingToken
  };
}

// So expoe o minimo necessario pra alguem com o link acompanhar o proprio
// chamado - nunca o id interno (o token carrega o id, mas a resposta HTTP
// nunca o repete), nunca historico, tecnico, anexos ou dados de outras OS.
export async function getPublicServiceOrderTracking(token) {
  const serviceOrderId = verifyPublicServiceOrderTrackingToken(trim(token, 2000));
  if (!serviceOrderId) {
    throw notFoundError("Não foi possível localizar este chamado pelo link informado.");
  }

  const serviceOrder = await findServiceOrderById(serviceOrderId);
  if (!serviceOrder) {
    throw notFoundError("Não foi possível localizar este chamado pelo link informado.");
  }

  const settings = await getServiceOrderSettings();
  const sla = calculateServiceOrderSla(serviceOrder, settings);

  return {
    number: serviceOrder.number,
    title: serviceOrder.title,
    status: serviceOrder.status,
    priority: serviceOrder.priority,
    createdAt: serviceOrder.createdAt,
    updatedAt: serviceOrder.updatedAt,
    sla: { status: sla.status, dueAt: sla.dueAt }
  };
}
