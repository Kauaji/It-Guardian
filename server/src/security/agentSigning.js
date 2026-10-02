import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";

/**
 * Assinatura de mensagens para o agente Windows (ECDSA P-256 / SHA-256).
 *
 * Duas chaves, dois papeis:
 *  - chave de RELEASE: assina o manifesto de atualizacao do agente. Fica FORA do
 *    servidor da API (maquina de build/CI ou offline). O servidor so repassa a
 *    assinatura; comprometer a API nao permite empurrar um executavel malicioso.
 *  - chave de JOBS: assina cada job de script entregue ao agente. Fica no
 *    servidor (ele cria os jobs); protege contra adulteracao no caminho/banco e
 *    contra replay, nao contra um servidor totalmente comprometido.
 *
 * O agente guarda as chaves PUBLICAS (base64 de SubjectPublicKeyInfo DER) e
 * reconstroi a mensagem a partir dos campos recebidos -- nunca confia numa
 * string "pronta" enviada junto com a assinatura.
 *
 * Formato da assinatura: IEEE P1363 (r||s, 64 bytes), em base64.
 */

export const UPDATE_MESSAGE_TAG = "ITG-UPDATE-V1";
export const JOB_MESSAGE_TAG = "ITG-JOB-V1";
export const JOB_SIGNATURE_TTL_SECONDS = 15 * 60;

// SubjectPublicKeyInfo de uma chave EC P-256: cabecalho fixo de 26 bytes + ponto nao comprimido (65 bytes).
const P256_SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");

function field(name, value) {
  const text = String(value ?? "");
  if (/[\r\n]/.test(text)) throw new Error(`Campo ${name} nao pode conter quebra de linha.`);
  return `${name}=${text}`;
}

export function sha256Hex(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function buildUpdateMessage({ version, sha256, url }) {
  return [UPDATE_MESSAGE_TAG, field("version", version), field("sha256", String(sha256).toLowerCase()), field("url", url)].join("\n");
}

export function buildJobMessage({ jobId, assetId, interpreter, timeoutSeconds, contentSha256, notAfter }) {
  return [
    JOB_MESSAGE_TAG,
    field("jobId", jobId),
    field("assetId", assetId),
    field("interpreter", interpreter),
    field("timeoutSeconds", timeoutSeconds),
    field("contentSha256", String(contentSha256).toLowerCase()),
    field("notAfter", notAfter)
  ].join("\n");
}

export function generateSigningKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicKeyBase64: publicKey.export({ type: "spki", format: "der" }).toString("base64")
  };
}

/** Aceita PEM direto ou PEM com "\n" literais (como costuma vir de variavel de ambiente). */
export function normalizePrivateKeyPem(value) {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

export function derivePublicKeyBase64(privateKeyPem) {
  const publicKey = createPublicKey(createPrivateKey(normalizePrivateKeyPem(privateKeyPem)));
  return publicKey.export({ type: "spki", format: "der" }).toString("base64");
}

export function signMessage(privateKeyPem, message) {
  const key = createPrivateKey(normalizePrivateKeyPem(privateKeyPem));
  return sign("sha256", Buffer.from(message, "utf8"), { key, dsaEncoding: "ieee-p1363" }).toString("base64");
}

export function isP256PublicKey(publicKeyBase64) {
  const der = Buffer.from(String(publicKeyBase64 || ""), "base64");
  return der.length === P256_SPKI_PREFIX.length + 65 && der.subarray(0, P256_SPKI_PREFIX.length).equals(P256_SPKI_PREFIX) && der[P256_SPKI_PREFIX.length] === 0x04;
}

export function verifyMessage(publicKeyBase64, message, signatureBase64) {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyBase64, "base64"), format: "der", type: "spki" });
    return verify("sha256", Buffer.from(message, "utf8"), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

/** Assina um job para um ativo especifico; `now` injetavel para teste. */
export function signJob(privateKeyPem, job, { now = Date.now(), ttlSeconds = JOB_SIGNATURE_TTL_SECONDS } = {}) {
  const notAfter = Math.floor(now / 1000) + ttlSeconds;
  const fields = {
    jobId: job.jobId,
    assetId: job.assetId,
    interpreter: job.interpreter,
    timeoutSeconds: job.timeoutSeconds,
    contentSha256: sha256Hex(job.content),
    notAfter
  };
  return { notAfter, signature: signMessage(privateKeyPem, buildJobMessage(fields)) };
}

export function signUpdateManifest(privateKeyPem, manifest) {
  return signMessage(privateKeyPem, buildUpdateMessage(manifest));
}
