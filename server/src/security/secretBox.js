import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { getJwtSecret } from "../config/environment.js";

const VERSION = "v1";
const KEY_INFO = "it-guardian/secret-box/v1";

function deriveKey() {
  // MFA_ENCRYPTION_KEY permite rotacionar a cifragem dos segredos sem
  // invalidar as sessoes (JWT_SECRET); sem ela, deriva da chave do JWT.
  const material = process.env.MFA_ENCRYPTION_KEY || getJwtSecret();
  return Buffer.from(hkdfSync("sha256", Buffer.from(material), Buffer.from("it-guardian"), KEY_INFO, 32));
}

/** Cifra um texto curto com AES-256-GCM (segredos TOTP em repouso). */
export function sealSecret(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function openSecret(sealed) {
  const [version, iv, tag, ciphertext] = String(sealed || "").split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Segredo cifrado em formato desconhecido.");
  }
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
