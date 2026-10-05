// Espelho LOCAL da politica de senha do servidor (server/src/domain/passwordPolicy.js)
// so para dar feedback imediato. O servidor continua sendo a autoridade: a lista de
// senhas comuns e as sequencias NAO sao duplicadas aqui; se o servidor recusar,
// a interface mostra a mensagem dele.
export const PASSWORD_MIN_LENGTH = 12;
// bcrypt ignora tudo depois de 72 bytes.
export const PASSWORD_MAX_BYTES = 72;

const encoder = new TextEncoder();

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isRepeatedPattern(normalized) {
  if (!normalized) return true;
  for (let size = 1; size <= 4; size += 1) {
    const unit = normalized.slice(0, size);
    if (unit.repeat(Math.ceil(normalized.length / size)).slice(0, normalized.length) === normalized) return true;
  }
  return false;
}

function identityTokens({ email, name }) {
  const tokens = [normalize(String(email || "").split("@")[0])];
  for (const part of String(name || "").split(/\s+/)) tokens.push(normalize(part));
  return tokens.filter((token) => token.length >= 4);
}

export function byteLength(value) {
  return encoder.encode(String(value ?? "")).length;
}

/** Regras mostradas como checklist enquanto a pessoa digita. */
export function passwordChecklist(password) {
  const value = String(password ?? "");
  return [
    { id: "length", label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, met: value.length >= PASSWORD_MIN_LENGTH },
    { id: "bytes", label: `No máximo ${PASSWORD_MAX_BYTES} bytes`, met: byteLength(value) <= PASSWORD_MAX_BYTES }
  ];
}

/**
 * Valida o que da para validar sem o servidor. Retorna `{ valid, errors }`
 * com as mesmas mensagens que o servidor usaria para essas regras.
 */
export function validatePasswordLocally(password, { email = "", name = "" } = {}) {
  const value = String(password ?? "");
  const errors = [];

  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(`A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (byteLength(value) > PASSWORD_MAX_BYTES) {
    errors.push(`A senha pode ter no máximo ${PASSWORD_MAX_BYTES} bytes.`);
  }
  if (!value.trim()) {
    errors.push("A senha não pode ser formada só por espaços.");
  }
  if (value.length >= PASSWORD_MIN_LENGTH) {
    const normalized = normalize(value);
    if (new Set(value).size < 5 || isRepeatedPattern(normalized)) {
      errors.push("A senha é previsível demais (repetições ou sequências).");
    } else if (identityTokens({ email, name }).some((token) => normalized.includes(token))) {
      errors.push("A senha não pode conter seu nome ou e-mail.");
    }
  }
  return { valid: errors.length === 0, errors };
}

const strengthLabels = ["Muito curta", "Razoável", "Boa", "Forte"];

/**
 * Indicador de forca apenas ilustrativo (0 a 3): comprimento manda; variedade
 * de caracteres ajuda. Nao substitui a validacao do servidor.
 */
export function passwordStrength(password) {
  const value = String(password ?? "");
  if (value.length < PASSWORD_MIN_LENGTH) return { score: 0, label: strengthLabels[0] };
  let score = 1;
  if (value.length >= 16) score += 1;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(value)).length;
  if (value.length >= 20 || (value.length >= 16 && classes >= 3) || (value.length >= 14 && value.includes(" ") && classes >= 2)) {
    score += 1;
  }
  const capped = Math.min(score, 3);
  return { score: capped, label: strengthLabels[capped] };
}
