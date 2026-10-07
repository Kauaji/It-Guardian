import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

/**
 * @param {Uint8Array} buffer
 * @returns {string} Base32 (RFC 4648) sem preenchimento.
 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/**
 * @param {unknown} text Base32 com ou sem `=` e espacos.
 * @returns {Buffer}
 * @throws {Error} Para caracteres fora do alfabeto.
 */
export function base32Decode(text) {
  const clean = String(text || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  /** @type {number[]} */
  const bytes = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Segredo TOTP inválido.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** @returns {string} Segredo TOTP aleatorio de 160 bits em Base32. */
export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

/**
 * @param {Buffer} secretBuffer
 * @param {number} counter
 * @param {number} [digits]
 * @returns {string} Codigo HOTP (RFC 4226) com zeros a esquerda.
 */
export function hotp(secretBuffer, counter, digits = TOTP_DIGITS) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secretBuffer).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/**
 * @param {string} secret Segredo em Base32.
 * @param {number} [timeMs]
 * @param {number} [digits]
 * @returns {string}
 */
export function totpAt(secret, timeMs = Date.now(), digits = TOTP_DIGITS) {
  const step = Math.floor(timeMs / 1000 / TOTP_PERIOD_SECONDS);
  return hotp(base32Decode(secret), step, digits);
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Verifica um codigo TOTP aceitando +-`window` passos de relogio. Devolve o
 * passo (inteiro) que casou ou null. `lastUsedStep` impede reutilizar o mesmo
 * codigo (ou um anterior) -- protecao contra replay de um codigo observado.
 */
/**
 * @param {string} secret Segredo em Base32.
 * @param {unknown} code
 * @param {{ timeMs?: number, window?: number, lastUsedStep?: number | string | null }} [options]
 * @returns {number | null}
 */
export function verifyTotp(secret, code, { timeMs = Date.now(), window = 1, lastUsedStep = null } = {}) {
  const candidate = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(candidate)) return null;
  const secretBuffer = base32Decode(secret);
  const currentStep = Math.floor(timeMs / 1000 / TOTP_PERIOD_SECONDS);
  /** @type {number | null} */
  let matched = null;
  for (let offset = -window; offset <= window; offset += 1) {
    const step = currentStep + offset;
    if (step < 0) continue;
    if (safeEqual(hotp(secretBuffer, step), candidate) && matched === null) matched = step;
  }
  if (matched === null) return null;
  if (lastUsedStep !== null && lastUsedStep !== undefined && matched <= Number(lastUsedStep)) return null;
  return matched;
}

/**
 * @param {{ secret: string, accountName: string, issuer?: string }} input
 * @returns {string} URI `otpauth://` para QR code de apps autenticadores.
 */
export function buildOtpauthUri({ secret, accountName, issuer = "IT Guardian" }) {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS)
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** @returns {string} Codigo de recuperacao `XXXXX-XXXXX`. */
export function generateRecoveryCode() {
  const bytes = randomBytes(10);
  let raw = "";
  for (const byte of bytes) raw += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** @param {unknown} value */
export function normalizeRecoveryCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
