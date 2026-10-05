import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/environment.js";

const issuer = "it-guardian";
const audience = "public-support-machine";

export function createPublicMachineToken(activationId) {
  if (!activationId) return "";
  return jwt.sign({ activationId }, getJwtSecret(), {
    issuer,
    audience,
    expiresIn: "180d"
  });
}

export function verifyPublicMachineToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret(), { issuer, audience });
    return typeof payload.activationId === "string" ? payload.activationId : null;
  } catch {
    return null;
  }
}
