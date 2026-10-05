import { badRequest } from "../lib/errors.js";

/**
 * Validacao e normalizacao dos payloads enviados pelo coletor Windows
 * (heartbeat/inventario e resultado de trabalhos): lista fechada de campos,
 * limites de tamanho, remocao de caracteres NUL e coerencia entre valores.
 * Modulo puro.
 */

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

/** @param {string} value */
function removeNulFromText(value) {
  return value.split("\u0000").join("");
}

/**
 * @param {unknown} value
 * @returns {unknown} Copia sem caracteres NUL em textos e chaves.
 */
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

/**
 * Texto aparado, sem NUL e limitado a `max`; `null` quando vazio (nunca com `required: true`).
 *
 * @overload
 * @param {unknown} value
 * @param {string} field Nome do campo nas mensagens de erro.
 * @param {{ required: true, max?: number }} options
 * @returns {string}
 *
 * @overload
 * @param {unknown} value
 * @param {string} field Nome do campo nas mensagens de erro.
 * @param {{ required?: false, max?: number }} [options]
 * @returns {string | null}
 *
 * @param {unknown} value
 * @param {string} field
 * @param {{ required?: boolean, max?: number }} [options]
 * @throws {import("../lib/errors.js").AppError} 400 quando obrigatorio e vazio ou acima do limite.
 */
export function text(value, field, { required = false, max = 255 } = {}) {
  const normalized = removeNulFromText(String(value ?? "")).trim();
  if (required && !normalized) throw badRequest(`O campo ${field} e obrigatorio.`);
  if (normalized.length > max) throw badRequest(`O campo ${field} excede ${max} caracteres.`);
  return normalized || null;
}

/**
 * Inteiro seguro dentro de [min, max]; `fallback` quando ausente ou vazio.
 *
 * @overload
 * @param {unknown} value
 * @param {string} field
 * @param {{ min?: number, max?: number, fallback: number }} options
 * @returns {number}
 *
 * @overload
 * @param {unknown} value
 * @param {string} field
 * @param {{ min?: number, max?: number, fallback?: null }} [options]
 * @returns {number | null}
 *
 * @param {unknown} value
 * @param {string} field
 * @param {{ min?: number, max?: number, fallback?: number | null }} [options]
 * @throws {import("../lib/errors.js").AppError} 400 para valor invalido.
 */
export function integer(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = null } = {}) {
  if (value == null || value === "") return fallback;
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    throw badRequest(`O campo ${field} possui valor invalido.`);
  }
  return normalized;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {{ maxBytes?: number }} [options]
 * @returns {Record<string, unknown>}
 */
function structuredObject(value, field, { maxBytes = 1024 * 1024 } = {}) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`O campo ${field} deve ser um objeto.`);
  }
  /** @type {string} */
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

/**
 * Payload de heartbeat/inventario ja validado e normalizado.
 * @typedef {object} AgentPayload
 * @property {string} machineId
 * @property {string} hostname
 * @property {string | null} machineAlias
 * @property {string} operatingSystem
 * @property {string} osArchitecture
 * @property {string | null} windowsVersion
 * @property {string | null} localIp
 * @property {string | null} macAddress
 * @property {string | null} cpuModel
 * @property {number | null} cpuUsagePercent
 * @property {number | null} memoryTotalBytes
 * @property {number | null} memoryUsedBytes
 * @property {number | null} memoryFreeBytes
 * @property {number | null} diskTotalBytes
 * @property {number | null} diskFreeBytes
 * @property {string | null} deviceManufacturer
 * @property {string | null} deviceModel
 * @property {string | null} serialNumber
 * @property {number | null} uptimeSeconds
 * @property {string | null} loggedUser
 * @property {string} agentVersion
 * @property {string} collectedAt ISO 8601.
 * @property {number} intervalSeconds
 * @property {string | null} environment
 * @property {string | null} group
 * @property {string | null} segment
 * @property {Record<string, unknown>} inventoryDetails
 */

/**
 * @param {unknown} input Corpo enviado pelo coletor.
 * @returns {AgentPayload}
 * @throws {import("../lib/errors.js").AppError} 400 para campo desconhecido, ausente ou incoerente.
 */
export function validateAgentPayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("Payload do agente invalido.");
  }

  const fields = /** @type {Record<string, unknown>} */ (input);
  const unknownFields = Object.keys(fields).filter((field) => !acceptedFields.has(field));
  if (unknownFields.length) {
    throw badRequest(`Campos nao aceitos: ${unknownFields.join(", ")}.`);
  }

  const collectedAt = text(fields.collectedAt, "collectedAt", { required: true, max: 40 });
  if (Number.isNaN(Date.parse(collectedAt))) throw badRequest("O campo collectedAt deve ser uma data ISO valida.");

  const payload = {
    machineId: text(fields.machineId, "machineId", { required: true, max: 180 }),
    hostname: text(fields.hostname, "hostname", { required: true, max: 180 }),
    machineAlias: text(fields.machineAlias, "machineAlias", { max: 180 }),
    operatingSystem: text(fields.operatingSystem, "operatingSystem", { required: true, max: 180 }),
    osArchitecture: text(fields.osArchitecture, "osArchitecture", { required: true, max: 80 }),
    windowsVersion: text(fields.windowsVersion, "windowsVersion", { max: 180 }),
    localIp: text(fields.localIp, "localIp", { max: 64 }),
    macAddress: text(fields.macAddress, "macAddress", { max: 32 }),
    cpuModel: text(fields.cpuModel, "cpuModel", { max: 255 }),
    cpuUsagePercent: integer(fields.cpuUsagePercent, "cpuUsagePercent", { max: 100 }),
    memoryTotalBytes: integer(fields.memoryTotalBytes, "memoryTotalBytes"),
    memoryUsedBytes: integer(fields.memoryUsedBytes, "memoryUsedBytes"),
    memoryFreeBytes: integer(fields.memoryFreeBytes, "memoryFreeBytes"),
    diskTotalBytes: integer(fields.diskTotalBytes, "diskTotalBytes"),
    diskFreeBytes: integer(fields.diskFreeBytes, "diskFreeBytes"),
    deviceManufacturer: text(fields.deviceManufacturer, "deviceManufacturer", { max: 180 }),
    deviceModel: text(fields.deviceModel, "deviceModel", { max: 180 }),
    serialNumber: text(fields.serialNumber, "serialNumber", { max: 180 }),
    uptimeSeconds: integer(fields.uptimeSeconds, "uptimeSeconds"),
    loggedUser: text(fields.loggedUser, "loggedUser", { max: 180 }),
    agentVersion: text(fields.agentVersion, "agentVersion", { required: true, max: 40 }),
    collectedAt: new Date(collectedAt).toISOString(),
    intervalSeconds: integer(fields.intervalSeconds, "intervalSeconds", {
      min: 30,
      max: 86400,
      fallback: 300
    }),
    environment: text(fields.environment, "environment", { max: 120 }),
    group: text(fields.group, "group", { max: 120 }),
    segment: text(fields.segment, "segment", { max: 120 }),
    inventoryDetails: structuredObject(fields.inventoryDetails, "inventoryDetails")
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

/** Valida o nome informado ao criar um enrollment (token do agente). */
/**
 * @param {unknown} name
 * @returns {string}
 */
export function validateEnrollmentName(name) {
  return text(name, "name", { required: true, max: 120 });
}

/**
 * Valida o corpo do resultado de um trabalho do agente e o converte no formato
 * esperado por completeAgentScriptJob.
 */
/**
 * @param {{ jobId: unknown, body: unknown }} input
 * @returns {{ jobId: string, result: { exitCode: number | null, timedOut: boolean, stdout: string, stderr: string, errorMessage: string } }}
 */
export function validateJobResultPayload({ jobId, body: rawBody }) {
  const body = /** @type {Record<string, unknown> | null | undefined} */ (rawBody);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Resultado de execucao invalido.");
  }
  const exitCode =
    body.exitCode == null ? null : integer(body.exitCode, "exitCode", { min: -2147483648, max: 2147483647 });

  return {
    jobId: text(jobId, "jobId", { required: true, max: 180 }),
    result: {
      exitCode,
      timedOut: body.timedOut === true,
      stdout: text(body.stdout, "stdout", { max: 65536 }) || "",
      stderr: text(body.stderr, "stderr", { max: 65536 }) || "",
      errorMessage: text(body.errorMessage, "errorMessage", { max: 4000 }) || ""
    }
  };
}
