import {
  activateCollector as activateCollectorRecord,
  createProductKey as createProductKeyRecord,
  deactivateDeviceActivation,
  listDeviceActivations,
  listProductKeys,
  setProductKeyActive,
  updateProductKeyMonitoring
} from "../repositories/productKeyRepository.js";
import { getFrontendUrl } from "../config/environment.js";
import { createPublicMachineToken } from "../domain/publicMachineToken.js";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.expose = true;
  return error;
}

function text(value, field, { required = false, max = 180 } = {}) {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw badRequest(`O campo ${field} e obrigatorio.`);
  if (normalized.length > max) throw badRequest(`O campo ${field} excede ${max} caracteres.`);
  return normalized || null;
}

function positiveInteger(value, field, { max = 100000 } = {}) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > max) {
    throw badRequest(`O campo ${field} possui valor invalido.`);
  }
  return normalized;
}

function optionalDate(value) {
  if (value == null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw badRequest("A data de expiracao e invalida.");
  if (parsed.getTime() <= Date.now()) throw badRequest("A data de expiracao deve estar no futuro.");
  return parsed.toISOString();
}

function monitoringAddress(value, field) {
  const normalized = text(value, field, { required: true, max: 500 });
  const hasControlCharacter = [...normalized].some(
    (character) => character.charCodeAt(0) < 32
  );
  if (normalized.includes('"') || normalized.includes("\\") || hasControlCharacter) {
    throw badRequest(`O campo ${field} possui caracteres invalidos.`);
  }
  return normalized;
}

export function validateMonitoringConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("Informe a configuracao de monitoramento.");
  }

  const ocsServerUrl = monitoringAddress(input.ocsServerUrl, "ocsServerUrl");
  let parsedOcsUrl;
  try {
    parsedOcsUrl = new URL(ocsServerUrl);
  } catch {
    throw badRequest("A URL do OCS e invalida.");
  }
  if (!["http:", "https:"].includes(parsedOcsUrl.protocol)) {
    throw badRequest("A URL do OCS deve usar HTTP ou HTTPS.");
  }
  if (parsedOcsUrl.username || parsedOcsUrl.password || parsedOcsUrl.hash) {
    throw badRequest("A URL do OCS nao pode conter credenciais ou fragmentos.");
  }

  return {
    ocsServerUrl: parsedOcsUrl.toString().replace(/\/$/, ""),
    zabbixServer: monitoringAddress(input.zabbixServer, "zabbixServer"),
    zabbixServerActive: monitoringAddress(
      input.zabbixServerActive,
      "zabbixServerActive"
    )
  };
}

export function validateActivationRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("Dados de ativacao invalidos.");
  }

  return {
    productKey: text(input.productKey, "productKey", { required: true, max: 64 }),
    machineFingerprint: text(input.machineFingerprint, "machineFingerprint", {
      required: true,
      max: 512
    }),
    hostname: text(input.hostname, "hostname", { required: true, max: 180 }),
    alias: text(input.alias, "alias", { max: 180 }),
    collectorVersion: text(input.collectorVersion, "collectorVersion", { max: 40 })
  };
}

export async function activateCollector(input) {
  const result = await activateCollectorRecord(validateActivationRequest(input));
  const publicAppUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") || getFrontendUrl();
  const publicMachineToken = createPublicMachineToken(result.activation.id);
  return {
    activationId: result.activation.id,
    agentToken: result.token,
    intervalSeconds: 300,
    heartbeatPath: "/api/agents/heartbeat",
    supportUrl: `${publicAppUrl}/abrir-chamado?device=${encodeURIComponent(publicMachineToken)}`,
    monitoring: result.monitoring,
    ocsServerUrl: result.monitoring.ocsServerUrl,
    zabbixServer: result.monitoring.zabbixServer,
    zabbixServerActive: result.monitoring.zabbixServerActive,
    organization: {
      displayName: result.productKey.displayName,
      organizationName: result.productKey.organizationName,
      planName: result.productKey.planName
    }
  };
}

export async function createManagedProductKey(input, userId) {
  const monitoring = input?.monitoring == null
    ? null
    : validateMonitoringConfig(input.monitoring);
  return createProductKeyRecord({
    displayName: text(input?.displayName, "displayName", { required: true, max: 120 }),
    organizationName: text(input?.organizationName, "organizationName", {
      required: true,
      max: 180
    }),
    planName: text(input?.planName, "planName", { required: true, max: 120 }),
    activationLimit: positiveInteger(input?.activationLimit, "activationLimit"),
    expiresAt: optionalDate(input?.expiresAt),
    createdBy: userId,
    monitoring
  });
}

export async function configureProductKeyMonitoring(id, input) {
  return updateProductKeyMonitoring(id, validateMonitoringConfig(input));
}

export { deactivateDeviceActivation, listDeviceActivations, listProductKeys, setProductKeyActive };
