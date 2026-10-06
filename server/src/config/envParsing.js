// Leitura tipada de variaveis de ambiente (funcoes puras, sem tocar em process.env).

export function isTruthyEnv(value) {
  return ["1", "true", "yes", "sim"].includes(String(value || "").trim().toLowerCase());
}

export function isTruthyEnvWithDefault(value, defaultValue) {
  if (value === undefined || value === null || String(value).trim() === "") return defaultValue;
  return isTruthyEnv(value);
}

export function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function parseIceUrls(value, { maxEntries = 4, maxLength = 200, schemes } = {}) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry.length <= maxLength)
    .filter((entry) => schemes.some((scheme) => entry.toLowerCase().startsWith(scheme)))
    .slice(0, maxEntries);
}
