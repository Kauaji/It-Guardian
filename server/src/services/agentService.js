import {
  authenticateAgentToken,
  createAgentEnrollment,
  listAgentEnrollments,
  recordAgentInventory,
  revokeAgentEnrollment
} from "../repositories/agentRepository.js";
import {
  claimNextAgentScriptJob,
  completeAgentScriptJob
} from "../repositories/agentScriptJobRepository.js";
import { getAgentAutoUpdateInfo, getFrontendUrl, isRemoteScriptExecutionEnabled } from "../config/environment.js";
import { createPublicMachineToken } from "../domain/publicMachineToken.js";

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
  "cpuUsagePercent",
  "memoryTotalBytes",
  "memoryUsedBytes",
  "memoryFreeBytes",
  "diskTotalBytes",
  "diskFreeBytes",
  "deviceManufacturer",
  "deviceModel",
  "serialNumber",
  "uptimeSeconds",
  "loggedUser",
  "agentVersion",
  "collectedAt",
  "intervalSeconds",
  "environment",
  "group",
  "segment",
  "inventoryDetails"
]);

function compareVersions(a, b) {
  const partsA = String(a || "0").split(".").map((part) => parseInt(part, 10) || 0);
  const partsB = String(b || "0").split(".").map((part) => parseInt(part, 10) || 0);
  const length = Math.max(partsA.length, partsB.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (partsA[index] || 0) - (partsB[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.expose = true;
  return error;
}

function removeNulFromText(value) {
  return value.split("\u0000").join("");
}

function removeNulCharacters(value) {
  if (typeof value === "string") return removeNulFromText(value);
  if (Array.isArray(value)) return value.map(removeNulCharacters);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      removeNulFromText(key),
      removeNulCharacters(nestedValue)
    ])
  );
}

function text(value, field, { required = false, max = 255 } = {}) {
  const normalized = removeNulFromText(String(value ?? "")).trim();
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

function structuredObject(value, field, { maxBytes = 1024 * 1024 } = {}) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`O campo ${field} deve ser um objeto.`);
  }
  let serialized;
  try {
    serialized = JSON.stringify(removeNulCharacters(value));
  } catch {
    throw badRequest(`O campo ${field} nao pode ser serializado.`);
  }
  if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
    throw badRequest(`O campo ${field} excede o tamanho permitido.`);
  }
  return JSON.parse(serialized);
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
    cpuUsagePercent: integer(input.cpuUsagePercent, "cpuUsagePercent", { max: 100 }),
    memoryTotalBytes: integer(input.memoryTotalBytes, "memoryTotalBytes"),
    memoryUsedBytes: integer(input.memoryUsedBytes, "memoryUsedBytes"),
    memoryFreeBytes: integer(input.memoryFreeBytes, "memoryFreeBytes"),
    diskTotalBytes: integer(input.diskTotalBytes, "diskTotalBytes"),
    diskFreeBytes: integer(input.diskFreeBytes, "diskFreeBytes"),
    deviceManufacturer: text(input.deviceManufacturer, "deviceManufacturer", { max: 180 }),
    deviceModel: text(input.deviceModel, "deviceModel", { max: 180 }),
    serialNumber: text(input.serialNumber, "serialNumber", { max: 180 }),
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
    segment: text(input.segment, "segment", { max: 120 }),
    inventoryDetails: structuredObject(input.inventoryDetails, "inventoryDetails")
  };

  if (
    payload.diskTotalBytes != null &&
    payload.diskFreeBytes != null &&
    payload.diskFreeBytes > payload.diskTotalBytes
  ) {
    throw badRequest("diskFreeBytes nao pode ser maior que diskTotalBytes.");
  }
  if (
    payload.memoryTotalBytes != null &&
    payload.memoryUsedBytes != null &&
    payload.memoryUsedBytes > payload.memoryTotalBytes
  ) {
    throw badRequest("memoryUsedBytes nao pode ser maior que memoryTotalBytes.");
  }
  if (
    payload.memoryTotalBytes != null &&
    payload.memoryFreeBytes != null &&
    payload.memoryFreeBytes > payload.memoryTotalBytes
  ) {
    throw badRequest("memoryFreeBytes nao pode ser maior que memoryTotalBytes.");
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
  const job = await claimNextAgentScriptJob({
    assetId: asset.id,
    enrollmentId: enrollment.id
  });

  const autoUpdate = getAgentAutoUpdateInfo();
  const reportedVersion = String(body?.agentVersion || "").trim();
  const updateAvailable =
    Boolean(autoUpdate.version) &&
    Boolean(reportedVersion) &&
    compareVersions(autoUpdate.version, reportedVersion) > 0;

  return {
    assetId: asset.id,
    acceptedAt: new Date().toISOString(),
    intervalSeconds: asset.intervalSeconds,
    remoteScriptExecutionEnabled: isRemoteScriptExecutionEnabled(),
    job,
    latestVersion: updateAvailable ? autoUpdate.version : null,
    latestVersionDownloadUrl: updateAvailable ? autoUpdate.downloadUrl : null,
    latestVersionSha256: updateAvailable ? autoUpdate.sha256 : null
  };
}

export async function completeAgentJob({ token, jobId, body }) {
  const enrollment = await authenticateAgentToken(token);
  if (!enrollment) {
    const error = new Error("Token do agente invalido ou revogado.");
    error.statusCode = 401;
    error.expose = true;
    throw error;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Resultado de execucao invalido.");
  }
  const exitCode =
    body.exitCode == null ? null : integer(body.exitCode, "exitCode", { min: -2147483648, max: 2147483647 });
  return completeAgentScriptJob({
    jobId: text(jobId, "jobId", { required: true, max: 180 }),
    enrollmentId: enrollment.id,
    result: {
      exitCode,
      timedOut: body.timedOut === true,
      stdout: text(body.stdout, "stdout", { max: 65536 }) || "",
      stderr: text(body.stderr, "stderr", { max: 65536 }) || "",
      errorMessage: text(body.errorMessage, "errorMessage", { max: 4000 }) || ""
    }
  });
}

export async function getAgentSupportLink({ token }) {
  const enrollment = await authenticateAgentToken(token);
  if (!enrollment) {
    const error = new Error("Token do agente invalido ou revogado.");
    error.statusCode = 401;
    error.expose = true;
    throw error;
  }
  if (!enrollment.activationId) {
    const error = new Error("Este agente nao possui uma ativacao vinculada.");
    error.statusCode = 409;
    error.expose = true;
    throw error;
  }

  const publicAppUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") || getFrontendUrl();
  const deviceToken = createPublicMachineToken(enrollment.activationId);
  return {
    supportUrl: `${publicAppUrl}/abrir-chamado?device=${encodeURIComponent(deviceToken)}`
  };
}

export async function createEnrollment({ name, userId }) {
  const normalizedName = text(name, "name", { required: true, max: 120 });
  return createAgentEnrollment({ name: normalizedName, createdBy: userId });
}

export { listAgentEnrollments, revokeAgentEnrollment };
