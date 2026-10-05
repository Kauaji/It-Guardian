import { createHash, randomBytes } from "node:crypto";

/** @returns {string} Token opaco `itg_...` com 256 bits de entropia. */
export function createAgentToken() {
  return `itg_${randomBytes(32).toString("base64url")}`;
}

/**
 * @param {unknown} token
 * @returns {string} SHA-256 hexadecimal (o servidor so guarda o hash).
 */
export function hashAgentToken(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}
