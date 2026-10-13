import { createHash, randomBytes } from "node:crypto";

// Tokens de uso unico enviados por e-mail (redefinicao de senha, convite). Dominio puro: so `node:crypto`.
// O token em claro existe apenas no e-mail; o banco guarda somente o hash SHA-256 (um vazamento do banco
// nao entrega links validos). 32 bytes aleatorios = 256 bits, entao SHA-256 simples basta (sem sal/bcrypt).

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DEFAULT_TTL_MINUTES = 30;
const MIN_TTL_MINUTES = 10;
const MAX_TTL_MINUTES = 120;

/**
 * @param {string} token
 * @returns {string} SHA-256 hexadecimal.
 */
export function hashActionToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

/** @returns {{ token: string, tokenHash: string }} */
export function generateActionToken() {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashActionToken(token) };
}

/**
 * Filtro barato antes de tocar no banco: so o formato que `generateActionToken` produz passa.
 * @param {unknown} value
 * @returns {value is string}
 */
export function isPlausibleActionToken(value) {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/**
 * @param {unknown} value Minutos configurados (texto de variavel de ambiente).
 * @returns {number} Entre 10 minutos e 2 horas; 30 quando ausente ou invalido.
 */
export function resolveActionTokenTtlMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_MINUTES;
  return Math.min(MAX_TTL_MINUTES, Math.max(MIN_TTL_MINUTES, Math.round(parsed)));
}
