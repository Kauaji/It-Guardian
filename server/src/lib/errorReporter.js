import { randomBytes } from "node:crypto";
import { logger, redact, redactPath } from "./logger.js";

// Envio best-effort de erros 5xx / falhas nao tratadas para fora do processo:
//  - SENTRY_DSN          -> API de envelopes do Sentry (ou compativel, ex.: GlitchTip)
//  - ERROR_WEBHOOK_URL   -> POST JSON generico (Slack/Teams/automacao propria)
// Nunca lanca e nunca atrasa a resposta; limita a taxa por "impressao digital".

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const seen = new Map();
let sender = (url, init) => fetch(url, init);

/** Permite trocar o transporte nos testes. */
export function setErrorReporterTransport(transport) {
  sender = transport || ((url, init) => fetch(url, init));
}

export function resetErrorReporterState() {
  seen.clear();
}

function fingerprintOf(error) {
  const firstFrame = String(error?.stack || "").split("\n")[1] || "";
  return `${error?.name || "Error"}:${error?.message || ""}:${firstFrame.trim()}`.slice(0, 300);
}

function allowed(fingerprint, now = Date.now()) {
  const entry = seen.get(fingerprint);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    seen.set(fingerprint, { windowStart: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

export function parseSentryDsn(dsn) {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split("/").filter(Boolean).pop();
    if (!url.username || !projectId) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username
    };
  } catch {
    return null;
  }
}

function stackFrames(stack) {
  return String(stack || "")
    .split("\n")
    .slice(1, 30)
    .map((line) => {
      const match = /at (?:(.*?) \()?(.*?):(\d+):(\d+)\)?$/.exec(line.trim());
      return match
        ? { function: match[1] || "<anonymous>", filename: match[2], lineno: Number(match[3]), colno: Number(match[4]) }
        : null;
    })
    .filter(Boolean)
    .reverse();
}

export function buildSentryEvent(error, context = {}) {
  return {
    event_id: randomBytes(16).toString("hex"),
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.APP_VERSION || undefined,
    server_name: process.env.HOSTNAME || undefined,
    exception: {
      values: [
        {
          type: error?.name || "Error",
          value: String(error?.message || error).slice(0, 1000),
          stacktrace: { frames: stackFrames(error?.stack) }
        }
      ]
    },
    request: context.path ? { method: context.method, url: redactPath(context.path) } : undefined,
    tags: { requestId: context.requestId, code: error?.code },
    extra: redact(context.extra || {})
  };
}

async function sendToSentry(error, context) {
  const parsed = parseSentryDsn(process.env.SENTRY_DSN || "");
  if (!parsed) return;
  const event = buildSentryEvent(error, context);
  const body = [
    JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event)
  ].join("\n");
  await sender(parsed.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-sentry-envelope",
      "x-sentry-auth": `Sentry sentry_version=7, sentry_client=it-guardian/1.0, sentry_key=${parsed.publicKey}`
    },
    body,
    signal: AbortSignal.timeout(3000)
  });
}

async function sendToWebhook(error, context) {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  await sender(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      service: "it-guardian-api",
      environment: process.env.NODE_ENV || "development",
      error: { name: error?.name, message: String(error?.message || error).slice(0, 500), code: error?.code },
      requestId: context.requestId,
      path: context.path ? redactPath(context.path) : undefined,
      method: context.method,
      time: new Date().toISOString()
    }),
    signal: AbortSignal.timeout(3000)
  });
}

export function reportError(error, context = {}) {
  if (!process.env.SENTRY_DSN && !process.env.ERROR_WEBHOOK_URL) return Promise.resolve(false);
  if (!allowed(fingerprintOf(error))) return Promise.resolve(false);
  return Promise.allSettled([sendToSentry(error, context), sendToWebhook(error, context)]).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn("error_report_failed", { message: result.reason?.message });
      }
    }
    return true;
  });
}
