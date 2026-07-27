import {
  authenticateAgentToken,
  createAgentEnrollment,
  listAgentEnrollments,
  recordAgentInventory,
  revokeAgentEnrollment
} from "../repositories/agentRepository.js";

const acceptedFields = new Set([
  "machineId",
  "hostname",
  "machineAlias",
  "operatingSystem",
  "osArchitecture",
  "windowsVersion",
  "localIp",
  "macAddress",
  "cpuModel",
  "memoryTotalBytes",
  "diskTotalBytes",
  "diskFreeBytes",
  "uptimeSeconds",
  "loggedUser",
  "agentVersion",
  "collectedAt",
  "intervalSeconds",
  "environment",
  "group",
  "segment"
]);

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.expose = true;
  return error;
}

function text(value, field, { required = false, max = 255 } = {}) {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw badRequest(`O campo ${field} e obrigatorio.`);
  if (normalized.length > max) throw badRequest(`O campo ${field} excede ${max} caracteres.`);
  return normalized || null;
}

function integer(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = null } = {}) {
  if (value == null || value === "") return fallback;
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    throw badRequest(`O campo ${field} possui valor invalido.`);
  }
  return normalized;
}

export function validateAgentPayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("Payload do agente invalido.");
  }

  const unknownFields = Object.keys(input).filter((field) => !acceptedFields.has(field));
  if (unknownFields.length) {
    throw badRequest(`Campos nao aceitos: ${unknownFields.join(", ")}.`);
  }

  const collectedAt = text(input.collectedAt, "collectedAt", { required: true, max: 40 });
  if (Number.isNaN(Date.parse(collectedAt))) throw badRequest("O campo collectedAt deve ser uma data ISO valida.");

  const payload = {
    machineId: text(input.machineId, "machineId", { required: true, max: 180 }),
    hostname: text(input.hostname, "hostname", { required: true, max: 180 }),
    machineAlias: text(input.machineAlias, "machineAlias", { max: 180 }),
    operatingSystem: text(input.operatingSystem, "operatingSystem", { required: true, max: 180 }),
    osArchitecture: text(input.osArchitecture, "osArchitecture", { required: true, max: 80 }),
    windowsVersion: text(input.windowsVersion, "windowsVersion", { max: 180 }),
    localIp: text(input.localIp, "localIp", { max: 64 }),
    macAddress: text(input.macAddress, "macAddress", { max: 32 }),
    cpuModel: text(input.cpuModel, "cpuModel", { max: 255 }),
    memoryTotalBytes: integer(input.memoryTotalBytes, "memoryTotalBytes"),
    diskTotalBytes: integer(input.diskTotalBytes, "diskTotalBytes"),
    diskFreeBytes: integer(input.diskFreeBytes, "diskFreeBytes"),
    uptimeSeconds: integer(input.uptimeSeconds, "uptimeSeconds"),
    loggedUser: text(input.loggedUser, "loggedUser", { max: 180 }),
    agentVersion: text(input.agentVersion, "agentVersion", { required: true, max: 40 }),
    collectedAt: new Date(collectedAt).toISOString(),
    intervalSeconds: integer(input.intervalSeconds, "intervalSeconds", {
      min: 30,
      max: 86400,
      fallback: 300
    }),
    environment: text(input.environment, "environment", { max: 120 }),
    group: text(input.group, "group", { max: 120 }),
    segment: text(input.segment, "segment", { max: 120 })
  };

  if (
    payload.diskTotalBytes != null &&
    payload.diskFreeBytes != null &&
    payload.diskFreeBytes > payload.diskTotalBytes
  ) {
    throw badRequest("diskFreeBytes nao pode ser maior que diskTotalBytes.");
  }

  return payload;
}

export async function receiveAgentInventory({ token, body }) {
  const enrollment = await authenticateAgentToken(token);
  if (!enrollment) {
    const error = new Error("Token do agente invalido ou revogado.");
    error.statusCode = 401;
    error.expose = true;
    throw error;
  }

  const asset = await recordAgentInventory({
    enrollment,
    payload: validateAgentPayload(body)
  });
  return {
    assetId: asset.id,
    acceptedAt: new Date().toISOString(),
    intervalSeconds: asset.intervalSeconds
  };
}

export async function createEnrollment({ name, userId }) {
  const normalizedName = text(name, "name", { required: true, max: 120 });
  return createAgentEnrollment({ name: normalizedName, createdBy: userId });
}

export { listAgentEnrollments, revokeAgentEnrollment };
