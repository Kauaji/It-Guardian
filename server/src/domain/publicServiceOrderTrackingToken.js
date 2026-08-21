import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/environment.js";

const issuer = "it-guardian";
// Audience diferente de publicMachineToken.js (mesmo segredo, mesma lib) -
// e o que impede um token de identidade de maquina ser reaproveitado como
// token de acompanhamento de OS, ou vice-versa.
const audience = "public-support-tracking";

export function createPublicServiceOrderTrackingToken(serviceOrderId) {
  if (!serviceOrderId) return "";
  return jwt.sign({ serviceOrderId }, getJwtSecret(), {
    issuer,
    audience,
    expiresIn: "180d"
  });
}

export function verifyPublicServiceOrderTrackingToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret(), { issuer, audience });
    return typeof payload.serviceOrderId === "string" ? payload.serviceOrderId : null;
  } catch {
    return null;
  }
}
