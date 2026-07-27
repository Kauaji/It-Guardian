export class ExternalIntegrationError extends Error {
  constructor(source, message, { cause, upstreamStatus = null } = {}) {
    super(message, { cause });
    this.name = "ExternalIntegrationError";
    this.code = "EXTERNAL_INTEGRATION_UNAVAILABLE";
    this.source = source;
    this.statusCode = 502;
    this.upstreamStatus = upstreamStatus;
    this.expose = true;
  }
}

function friendlyMessage(source) {
  return `Nao foi possivel conectar a integracao ${source}. Verifique a configuracao e tente novamente.`;
}

function shouldRetry(error) {
  return error?.name === "AbortError" ||
    error?.code === "ECONNRESET" ||
    error?.code === "ECONNREFUSED" ||
    error?.code === "ETIMEDOUT" ||
    Number(error?.upstreamStatus) >= 500;
}

export async function requestJson({
  source,
  url,
  method = "GET",
  headers = {},
  body,
  timeoutMs = 10000,
  retries = 1,
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== "function") {
    throw new ExternalIntegrationError(source, friendlyMessage(source));
  }

  let lastError;
  for (let attempt = 0; attempt <= Math.max(0, retries); attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(250, timeoutMs));
    try {
      const response = await fetchImpl(url, {
        method,
        headers: {
          accept: "application/json",
          ...headers
        },
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new ExternalIntegrationError(source, friendlyMessage(source), {
          upstreamStatus: response.status
        });
      }
      try {
        return await response.json();
      } catch (cause) {
        throw new ExternalIntegrationError(
          source,
          `A integracao ${source} respondeu em um formato invalido.`,
          { cause, upstreamStatus: response.status }
        );
      }
    } catch (cause) {
      lastError = cause instanceof ExternalIntegrationError
        ? cause
        : new ExternalIntegrationError(source, friendlyMessage(source), { cause });
      if (attempt >= retries || !shouldRetry(lastError)) throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new ExternalIntegrationError(source, friendlyMessage(source));
}

export function joinIntegrationUrl(baseUrl, path = "") {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  const suffix = String(path || "").trim();
  if (!base) return "";
  return suffix ? `${base}/${suffix.replace(/^\/+/, "")}` : base;
}
