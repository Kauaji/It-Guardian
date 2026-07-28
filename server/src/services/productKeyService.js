import {
  activateCollector as activateCollectorRecord,
  createProductKey as createProductKeyRecord,
  deactivateDeviceActivation,
  listDeviceActivations,
  listProductKeys,
  setProductKeyActive
} from "../repositories/productKeyRepository.js";
import { getFrontendUrl } from "../config/environment.js";

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
  return {
    activationId: result.activation.id,
    agentToken: result.token,
    intervalSeconds: 300,
    heartbeatPath: "/api/agents/heartbeat",
    supportUrl: `${publicAppUrl}/abrir-chamado`,
    organization: {
      displayName: result.productKey.displayName,
      organizationName: result.productKey.organizationName,
      planName: result.productKey.planName
    }
  };
}

export async function createManagedProductKey(input, userId) {
  return createProductKeyRecord({
    displayName: text(input?.displayName, "displayName", { required: true, max: 120 }),
    organizationName: text(input?.organizationName, "organizationName", {
      required: true,
      max: 180
    }),
    planName: text(input?.planName, "planName", { required: true, max: 120 }),
    activationLimit: positiveInteger(input?.activationLimit, "activationLimit"),
    expiresAt: optionalDate(input?.expiresAt),
    createdBy: userId
  });
}

export { deactivateDeviceActivation, listDeviceActivations, listProductKeys, setProductKeyActive };
