import { commonPasswordRoots, commonSequences } from "./commonPasswords.js";

export const PASSWORD_MIN_LENGTH = 12;
// bcrypt ignora tudo depois de 72 bytes: aceitar mais que isso daria uma
// falsa sensacao de seguranca.
export const PASSWORD_MAX_BYTES = 72;

/** @type {Record<string, string>} */
const leetMap = { "@": "a", "4": "a", "3": "e", "1": "i", "!": "i", "0": "o", "$": "s", "5": "s", "7": "t" };

/** @param {unknown} value */
function foldAccents(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** @param {string} value */
function alnumOnly(value) {
  return value.replace(/[^a-z0-9]/g, "");
}

/** @param {string} value */
function applyLeet(value) {
  return value.replace(/[@43$51!07]/g, (char) => leetMap[char] || char);
}

/** Forma "so letras e numeros", sem leetspeak: usada para sequencias e identidade. */
/** @param {unknown} value */
function normalizeForComparison(value) {
  return alnumOnly(foldAccents(value));
}

/**
 * Radicais candidatos de uma senha: tira numeros/simbolos do comeco e do fim
 * ("Senha@2024!!" -> "senha") e tenta com e sem leetspeak ("p@ssw0rd" ->
 * "password"). Assim sufixos tipicos nao disfarcam uma senha comum.
 */
/** @param {unknown} value */
function commonRootCandidates(value) {
  const folded = foldAccents(value);
  const trimmed = folded.replace(/^[^a-z]+/, "").replace(/[^a-z]+$/, "");
  return new Set([
    alnumOnly(folded),
    alnumOnly(folded).replace(/[0-9]/g, ""),
    alnumOnly(trimmed),
    alnumOnly(applyLeet(trimmed))
  ]);
}

const sequenceHaystacks = commonSequences.map((sequence) => sequence + sequence);

/** @param {string} normalized */
function isSequentialOrRepeated(normalized) {
  if (!normalized) return true;
  if (new Set(normalized).size <= 3) return true;
  for (let size = 1; size <= 4; size += 1) {
    const unit = normalized.slice(0, size);
    if (unit.repeat(Math.ceil(normalized.length / size)).slice(0, normalized.length) === normalized) {
      return true;
    }
  }
  return sequenceHaystacks.some((haystack) => haystack.includes(normalized));
}

/**
 * @param {string} normalized
 * @param {string[]} identities
 */
function containsIdentity(normalized, identities) {
  return identities.some((identity) => identity.length >= 4 && normalized.includes(identity));
}

/** @param {{ email?: unknown, name?: unknown }} identity */
function identityTokens({ email, name }) {
  /** @type {string[]} */
  const tokens = [];
  const local = String(email || "").split("@")[0];
  if (local) tokens.push(normalizeForComparison(local));
  for (const part of String(name || "").split(/\s+/)) {
    if (part) tokens.push(normalizeForComparison(part));
  }
  return tokens.filter(Boolean);
}

/**
 * Politica de senha (NIST SP 800-63B, simplificada): comprimento e lista de
 * bloqueio em vez de regras de composicao artificiais.
 * Retorna { valid, errors } com mensagens prontas para o usuario.
 *
 * @param {unknown} password
 * @param {{ email?: unknown, name?: unknown }} [context] Dados do usuario que a senha nao pode conter.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePassword(password, { email = "", name = "" } = {}) {
  /** @type {string[]} */
  const errors = [];
  const value = String(password ?? "");

  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(`A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (Buffer.byteLength(value, "utf8") > PASSWORD_MAX_BYTES) {
    errors.push(`A senha pode ter no máximo ${PASSWORD_MAX_BYTES} bytes.`);
  }
  if (!value.trim()) {
    errors.push("A senha não pode ser formada só por espaços.");
  }

  if (value.length >= PASSWORD_MIN_LENGTH) {
    const normalized = normalizeForComparison(value);

    if (new Set(value).size < 5 || isSequentialOrRepeated(normalized)) {
      errors.push("A senha é previsível demais (repetições ou sequências).");
    } else if ([...commonRootCandidates(value)].some((root) => root.length >= 4 && commonPasswordRoots.has(root))) {
      errors.push("Essa senha é muito comum. Escolha outra, de preferência uma frase longa.");
    } else if (containsIdentity(normalized, identityTokens({ email, name }))) {
      errors.push("A senha não pode conter seu nome ou e-mail.");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @param {unknown} password
 * @param {{ email?: unknown, name?: unknown }} [context]
 * @throws {import("../lib/errors.js").HttpErrorLike} 400 `WEAK_PASSWORD` com `details` = todas as violacoes.
 */
export function assertValidPassword(password, context) {
  const result = validatePassword(password, context);
  if (!result.valid) {
    /** @type {import("../lib/errors.js").HttpErrorLike} */
    const error = new Error(result.errors[0]);
    error.statusCode = 400;
    error.expose = true;
    error.code = "WEAK_PASSWORD";
    error.details = result.errors;
    throw error;
  }
}
