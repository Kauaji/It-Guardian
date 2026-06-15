import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env")
});

export const isVercel = process.env.VERCEL === "1";
export const vercelEnv = process.env.VERCEL_ENV || "";
export const isProduction = process.env.NODE_ENV === "production";
export const isProductionLike = isProduction || isVercel;

function isTruthyEnv(value) {
  return ["1", "true", "yes", "sim"].includes(String(value || "").trim().toLowerCase());
}

function isFalsyEnv(value) {
  return ["0", "false", "no", "nao", "não"].includes(String(value || "").trim().toLowerCase());
}

export function shouldSeedDemoData() {
  const flag = process.env.ENABLE_DEMO_SEED ?? process.env.IT_GUARDIAN_ENABLE_DEMO_SEED;

  if (isTruthyEnv(flag)) return true;
  if (isFalsyEnv(flag)) return false;

  return !isProductionLike || vercelEnv === "preview";
}

export function getFrontendUrl() {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  if (process.env.CLIENT_ORIGIN) return process.env.CLIENT_ORIGIN.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5173";
}

export function getCorsOrigins() {
  return Array.from(
    new Set([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      process.env.CLIENT_ORIGIN,
      process.env.FRONTEND_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null
    ].filter(Boolean).map((origin) => origin.replace(/\/$/, "")))
  );
}

export function isAllowedVercelOrigin(origin) {
  try {
    const url = new URL(origin);
    return isVercel && url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
  } catch (_error) {
    return false;
  }
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (isProductionLike && (!secret || secret === "dev-secret" || secret === "change-me-in-production")) {
    const error = new Error("JWT_SECRET precisa ser configurado com uma chave segura em produção.");
    error.statusCode = 500;
    throw error;
  }

  return secret || "dev-secret";
}

export function resolveDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL || "";
  const wantsMemory = databaseUrl === "memory" || process.env.DB_MODE === "memory";

  if (isProductionLike && wantsMemory) {
    const error = new Error("DATABASE_URL=memory não pode ser usado em produção. Configure Supabase ou Neon.");
    error.statusCode = 500;
    throw error;
  }

  if (isProductionLike && !databaseUrl) {
    const error = new Error("Erro ao conectar ao banco de dados. Configure DATABASE_URL no ambiente de produção.");
    error.statusCode = 500;
    throw error;
  }

  if (wantsMemory) {
    return { mode: "memory" };
  }

  const connectionString = databaseUrl || "postgres://itguardian:itguardian@localhost:5432/itguardian";
  const shouldUseSsl =
    process.env.DB_SSL === "true" ||
    (process.env.DB_SSL !== "false" &&
      (isProductionLike || /supabase|neon\.tech|pooler/i.test(connectionString)));

  return {
    mode: "postgres",
    connectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false
  };
}

