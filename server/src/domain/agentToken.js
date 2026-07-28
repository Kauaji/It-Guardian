import { createHash, randomBytes } from "node:crypto";

export function createAgentToken() {
  return `itg_${randomBytes(32).toString("base64url")}`;
}

export function hashAgentToken(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}
