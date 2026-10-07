/** @import { ApiError, ApiFetchOptions, QueryParams } from "./types.js" */

/**
 * @param {string | null | undefined} value URL absoluta ou vazio.
 * @returns {boolean} true para localhost, loopback, link-local e faixas privadas RFC 1918.
 */
export function isPrivateNetworkUrl(value) {
  if (!value) return false;

  try {
    const hostname = new URL(value).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "::1") {
      return true;
    }

    const octets = hostname.split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;

    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  } catch {
    return false;
  }
}

/**
 * @param {{ configuredUrl?: string | null, isDev?: boolean }} options
 * @returns {string} Base da API: "/api" em producao quando a URL configurada e privada.
 */
export function resolveApiBaseUrl({ configuredUrl, isDev }) {
  const configured = String(configuredUrl || "").trim();

  if (!isDev && isPrivateNetworkUrl(configured)) return "/api";
  return configured || (isDev ? "http://localhost:4000" : "/api");
}

export const API_BASE_URL = resolveApiBaseUrl({
  configuredUrl: import.meta.env.VITE_API_URL,
  isDev: import.meta.env.DEV
});

/** @param {string | null | undefined} baseUrl */
function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/$/, "");
}

/** @param {string} path Caminho da rota, com barra inicial (ex.: "/devices"). */
export function buildApiUrl(path) {
  const baseUrl = normalizeBaseUrl(API_BASE_URL);
  const apiPrefix = baseUrl.endsWith("/api") ? "" : "/api";
  return `${baseUrl}${apiPrefix}${path}`;
}

/** @returns {string | null} URL do WebSocket de monitoramento ou null quando desativado. */
export function buildWsUrl() {
  if (import.meta.env.VITE_ENABLE_WS !== "true" && !import.meta.env.DEV) {
    return null;
  }

  const configured = import.meta.env.VITE_WS_URL;
  if (configured) {
    if (!import.meta.env.DEV && isPrivateNetworkUrl(configured)) return null;
    return configured;
  }

  const apiUrl = buildApiUrl("").replace(/\/$/, "");
  const wsPath = apiUrl.replace(/^http/, "ws").replace(/\/api$/, "/ws");

  if (wsPath.startsWith("/") && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${wsPath}`;
  }

  return wsPath;
}

/**
 * Chama a API do IT Guardian e devolve o JSON da resposta.
 *
 * O tipo de retorno `T` e uma afirmacao do chamador (o servidor nao e validado em runtime):
 * cada funcao de dominio o fixa no seu `@returns`.
 *
 * @template [T=import("./types.js").ApiObject]
 * @param {string} path Caminho da rota, com barra inicial.
 * @param {ApiFetchOptions} [options] `token` vira `Authorization: Bearer`; o resto vai ao fetch.
 * @returns {Promise<T>}
 * @throws {ApiError} Falha de rede (sem `statusCode`) ou resposta nao-2xx (com `statusCode`).
 */
export async function apiFetch(path, { token, ...options } = {}) {
  let response;

  try {
    response = await fetch(buildApiUrl(path), {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error("Não foi possível conectar ao servidor.", { cause: error });
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || "Request failed";

    if (response.status === 401 && token && /token|sess/i.test(message) && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("it-guardian:auth-expired", { detail: { message } }));
    }

    /** @type {ApiError} */
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

/**
 * Monta o sufixo `?a=1&b=2` ignorando valores vazios (`""`, `null`, `undefined`).
 * Devolve "" quando nao sobra nenhum parametro.
 *
 * @param {QueryParams} [params]
 * @returns {string}
 */
export function buildQuerySuffix(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value != null) search.set(key, String(value));
  });
  return search.toString() ? `?${search}` : "";
}

/**
 * `new URLSearchParams(params)` para parametros com numeros/booleanos: o navegador
 * ja converte cada valor com `String()`, so o tipo de `Record<string, string>` nao sabia.
 *
 * @param {QueryParams} [params]
 * @returns {URLSearchParams}
 */
export function toSearchParams(params = {}) {
  return new URLSearchParams(/** @type {Record<string, string>} */ (params));
}
