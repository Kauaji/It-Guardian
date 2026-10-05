import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/environment.js";

const issuer = "it-guardian";
// Audience diferente de publicMachineToken.js (mesmo segredo, mesma lib) -
// e o que impede um token de identidade de maquina ser reaproveitado como
// token de acompanhamento de OS, ou vice-versa.
const audience = "public-support-tracking";

/**
 * @param {string | null | undefined} serviceOrderId
 * @returns {string} JWT de 180 dias ou "" quando o id esta vazio.
 */
export function createPublicServiceOrderTrackingToken(serviceOrderId) {
  if (!serviceOrderId) return "";
  return jwt.sign({ serviceOrderId }, getJwtSecret(), {
    issuer,
    audience,
    expiresIn: "180d"
  });
}

/**
 * @param {string | null | undefined} token
 * @returns {string | null} O id contido no token ou null se invalido/expirado.
 */
export function verifyPublicServiceOrderTrackingToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret(), { issuer, audience });
    return typeof payload !== "string" && typeof payload.serviceOrderId === "string" ? payload.serviceOrderId : null;
  } catch {
    return null;
  }
}
