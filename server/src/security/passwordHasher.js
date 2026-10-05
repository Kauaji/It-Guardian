import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getAuthConfig } from "../config/environment.js";

/** @param {unknown} plain */
export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), getAuthConfig().passwordHashCost);
}

/**
 * @param {unknown} plain
 * @param {string | null | undefined} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(plain ?? ""), hash);
}

/**
 * True quando o hash foi gerado com custo menor que o configurado hoje.
 *
 * @param {string | null | undefined} hash
 * @returns {boolean}
 */
export function passwordNeedsRehash(hash) {
  const match = /^\$2[aby]\$(\d{2})\$/.exec(String(hash || ""));
  if (!match) return true;
  return Number(match[1]) < getAuthConfig().passwordHashCost;
}

/** @type {Promise<string> | undefined} */
let dummyHashPromise;

/**
 * Hash descartavel com o custo atual: o login compara a senha contra ele
 * quando o usuario nao existe (ou esta bloqueado), para o tempo de resposta
 * nao revelar quais e-mails estao cadastrados.
 */
export function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(randomBytes(16).toString("hex"));
  return dummyHashPromise;
}

/** @param {unknown} plain */
export async function burnPasswordComparison(plain) {
  await bcrypt.compare(String(plain ?? ""), await getDummyHash());
}
