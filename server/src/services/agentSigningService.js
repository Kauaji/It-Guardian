import { derivePublicKeyBase64, isP256PublicKey, signJob, verifyMessage, buildUpdateMessage } from "../security/agentSigning.js";
import { logger } from "../lib/logger.js";

/**
 * Cola entre a configuracao (variaveis de ambiente) e o modulo de assinatura:
 *  - AGENT_JOB_SIGNING_PRIVATE_KEY: PEM da chave que assina cada job entregue ao agente.
 *  - AGENT_LATEST_VERSION_SIGNATURE: assinatura (feita FORA do servidor, com a chave de release)
 *    do manifesto de atualizacao; o servidor apenas a repassa.
 *  - AGENT_RELEASE_PUBLIC_KEY (opcional): permite ao servidor conferir a assinatura antes de oferecer
 *    a atualizacao, evitando propagar um manifesto invalido.
 */

let cachedKey = { raw: null, publicKey: null };
let warnedMissing = false;

function jobPrivateKey(env = process.env) {
  const raw = String(env.AGENT_JOB_SIGNING_PRIVATE_KEY || "").trim();
  return raw || null;
}

export function getJobSigningPublicKey(env = process.env) {
  const raw = jobPrivateKey(env);
  if (!raw) return null;
  if (cachedKey.raw !== raw) {
    try {
      cachedKey = { raw, publicKey: derivePublicKeyBase64(raw) };
    } catch (error) {
      logger.error("agent_job_signing_key_invalid", { message: error.message });
      cachedKey = { raw, publicKey: null };
    }
  }
  return cachedKey.publicKey;
}

/** Acrescenta `signature` e `notAfter` ao job; sem chave configurada devolve o job sem assinatura (com aviso unico). */
export function signJobForAgent(job, assetId, { env = process.env, now = Date.now() } = {}) {
  if (!job) return job;
  if (!getJobSigningPublicKey(env)) {
    if (!warnedMissing) {
      warnedMissing = true;
      logger.warn("agent_job_signing_disabled", {
        message:
          "AGENT_JOB_SIGNING_PRIVATE_KEY ausente/invalida: jobs sao entregues SEM assinatura e agentes com padroes seguros vao recusa-los. " +
          "Gere um par com `npm run agent:keys -- jobs`."
      });
    }
    return job;
  }
  const { signature, notAfter } = signJob(
    jobPrivateKey(env),
    { jobId: job.id, assetId, interpreter: job.type, timeoutSeconds: job.timeoutSeconds, content: job.content },
    { now }
  );
  return { ...job, signature, notAfter };
}

/** Oferece a atualizacao so se vier assinada (e, quando a chave publica de release estiver configurada, assinatura valida). */
export function resolveSignedUpdate(autoUpdate, env = process.env) {
  const empty = { version: null, downloadUrl: null, sha256: null, signature: null };
  if (!autoUpdate?.version) return empty;
  const signature = String(env.AGENT_LATEST_VERSION_SIGNATURE || "").trim();
  if (!signature) {
    logger.warn("agent_update_unsigned", { message: "AGENT_LATEST_VERSION_SIGNATURE ausente: atualizacao NAO oferecida (agentes exigem assinatura)." });
    return empty;
  }
  const releaseKey = String(env.AGENT_RELEASE_PUBLIC_KEY || "").trim();
  if (releaseKey) {
    const valid =
      isP256PublicKey(releaseKey) &&
      verifyMessage(
        releaseKey,
        buildUpdateMessage({ version: autoUpdate.version, sha256: autoUpdate.sha256, url: autoUpdate.downloadUrl }),
        signature
      );
    if (!valid) {
      logger.error("agent_update_signature_invalid", { version: autoUpdate.version });
      return empty;
    }
  }
  return { ...autoUpdate, signature };
}
