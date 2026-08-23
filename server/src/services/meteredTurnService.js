const CACHE_SAFETY_MARGIN_MS = 15 * 60 * 1000;
const CREDENTIAL_TTL_SECONDS = 6 * 60 * 60;

let cachedIceServers = null;
let cachedExpiresAt = 0;

function isMeteredConfigured(env) {
  return Boolean(env.REMOTE_ASSISTANCE_METERED_DOMAIN && env.REMOTE_ASSISTANCE_METERED_SECRET_KEY);
}

function logWarn(message, extra = {}) {
  console.warn(JSON.stringify({ level: "warn", event: "metered_turn", message, ...extra }));
}

async function fetchMeteredIceServers(env, fetchImpl) {
  const domain = String(env.REMOTE_ASSISTANCE_METERED_DOMAIN).trim().replace(/\/$/, "");
  const secretKey = String(env.REMOTE_ASSISTANCE_METERED_SECRET_KEY).trim();

  const createResponse = await fetchImpl(
    `https://${domain}/api/v1/turn/credential?secretKey=${encodeURIComponent(secretKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expiryInSeconds: CREDENTIAL_TTL_SECONDS,
        label: "it-guardian-remote-assistance"
      })
    }
  );
  if (!createResponse.ok) {
    throw new Error(`create-credential HTTP ${createResponse.status}`);
  }
  const created = await createResponse.json();
  if (!created?.apiKey) throw new Error("create-credential sem apiKey na resposta");

  const credentialsResponse = await fetchImpl(
    `https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(created.apiKey)}`
  );
  if (!credentialsResponse.ok) {
    throw new Error(`get-credentials HTTP ${credentialsResponse.status}`);
  }
  const iceServers = await credentialsResponse.json();
  if (!Array.isArray(iceServers) || !iceServers.length) {
    throw new Error("get-credentials devolveu uma lista vazia");
  }
  return { iceServers, expiryInSeconds: created.expiryInSeconds || CREDENTIAL_TTL_SECONDS };
}

/**
 * TURN de verdade via Metered.ca, pedido sob demanda e cacheado em memoria
 * pelo tempo de vida da credencial (renovada um pouco antes de expirar).
 * Pedir uma credencial nova a cada poll do agente/viewer desperdicaria a
 * cota deles em chamadas de API, nao em relay de midia -- e nao tem por que
 * ser mais frequente, ja que a mesma credencial serve para qualquer sessao
 * enquanto for valida. Se a chave nao estiver configurada ou a API deles
 * falhar, cai de volta na lista estatica de STUN/TURN (REMOTE_ASSISTANCE_
 * STUN_URLS / _TURN_URL) sem nunca quebrar a assistencia remota por causa
 * de uma dependencia externa.
 */
export async function resolveIceServers(config, env = process.env, fetchImpl = fetch) {
  const fallback = config?.webrtc?.iceServers || [];
  if (!isMeteredConfigured(env)) return fallback;
  if (cachedIceServers && Date.now() < cachedExpiresAt) return cachedIceServers;
  try {
    const { iceServers, expiryInSeconds } = await fetchMeteredIceServers(env, fetchImpl);
    cachedIceServers = iceServers;
    cachedExpiresAt = Date.now() + expiryInSeconds * 1000 - CACHE_SAFETY_MARGIN_MS;
    return cachedIceServers;
  } catch (error) {
    logWarn("Falha ao obter credencial TURN da Metered; usando lista estatica de fallback.", {
      error: error.message
    });
    return cachedIceServers || fallback;
  }
}

/** Uso exclusivo dos testes: garante que cada teste comeca sem cache preso do anterior. */
export function resetMeteredTurnCacheForTests() {
  cachedIceServers = null;
  cachedExpiresAt = 0;
}
