import { createHash, randomBytes } from "node:crypto";

const PRODUCT_KEY_PREFIX = "ITG";
const PRODUCT_KEY_GROUPS = 5;
const PRODUCT_KEY_GROUP_SIZE = 4;

/** @param {unknown} value */
function compact(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * @param {unknown} value
 * @returns {string} Chave `ITG-XXXX-XXXX-XXXX-XXXX-XXXX` ou "" quando invalida.
 */
export function normalizeProductKey(value) {
  const normalized = compact(value);
  const expectedLength = PRODUCT_KEY_PREFIX.length + PRODUCT_KEY_GROUPS * PRODUCT_KEY_GROUP_SIZE;

  if (normalized.length !== expectedLength || !normalized.startsWith(PRODUCT_KEY_PREFIX) || !/^[A-Z0-9]+$/.test(normalized)) {
    return "";
  }

  const payload = normalized.slice(PRODUCT_KEY_PREFIX.length);
  // O tamanho ja foi validado acima, entao o payload sempre divide em grupos exatos.
  const groups = payload.match(new RegExp(`.{${PRODUCT_KEY_GROUP_SIZE}}`, "g")) ?? [];
  return `${PRODUCT_KEY_PREFIX}-${groups.join("-")}`;
}

/**
 * @param {unknown} value
 * @returns {string} SHA-256 da chave normalizada ou "" se invalida.
 */
export function hashProductKey(value) {
  const normalized = normalizeProductKey(value);
  if (!normalized) return "";
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * @param {unknown} value
 * @returns {string} Dica mascarada (`ITG-XXXX-****-****-XXXX`) ou "".
 */
export function productKeyHint(value) {
  const normalized = normalizeProductKey(value);
  if (!normalized) return "";
  const groups = normalized.split("-");
  return `${groups[0]}-${groups[1]}-****-****-${groups.at(-1)}`;
}

/** @returns {string} Nova chave aleatoria normalizada. */
export function generateProductKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(PRODUCT_KEY_GROUPS * PRODUCT_KEY_GROUP_SIZE);
  let payload = "";

  for (const byte of bytes) {
    payload += alphabet[byte % alphabet.length];
  }

  return normalizeProductKey(`${PRODUCT_KEY_PREFIX}${payload}`);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function hashMachineFingerprint(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
