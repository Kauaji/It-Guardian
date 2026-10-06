import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/environment.js";

const issuer = "it-guardian";
const audience = "public-support-machine";

/**
 * @param {string | null | undefined} activationId
 * @returns {string} JWT de 180 dias ou "" quando o id esta vazio.
 */
export function createPublicMachineToken(activationId) {
  if (!activationId) return "";
  return jwt.sign({ activationId }, getJwtSecret(), {
    issuer,
    audience,
    expiresIn: "180d"
  });
}

/**
 * @param {string | null | undefined} token
 * @returns {string | null} O id contido no token ou null se invalido/expirado.
 */
export function verifyPublicMachineToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret(), { issuer, audience });
    return typeof payload !== "string" && typeof payload.activationId === "string" ? payload.activationId : null;
  } catch {
    return null;
  }
}
