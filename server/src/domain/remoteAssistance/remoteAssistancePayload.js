import { createHash, randomBytes } from "node:crypto";
import { hasPermission } from "../../permissions.js";
import { publicError } from "./remoteAssistanceErrors.js";

export function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export function issueSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function normalizeReason(value) {
  const reason = String(value || "").trim().replace(/\s+/g, " ").slice(0, 500);
  if (reason.length < 5) {
    throw publicError("Descreva brevemente o motivo da assistencia remota.");
  }
  return reason;
}

const MAX_CHAT_MESSAGE_LENGTH = 2000;

export function normalizeChatMessageText(value) {
  const text = String(value || "").trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
  if (!text) throw publicError("Mensagem vazia.");
  return text;
}

export function normalizeMonitors(monitors) {
  if (!Array.isArray(monitors)) return [];
  return monitors.slice(0, 8).map((monitor, index) => ({
    id: String(monitor?.id ?? index).trim().slice(0, 100) || String(index),
    name: String(monitor?.name || `Monitor ${index + 1}`).trim().slice(0, 100),
    primary: Boolean(monitor?.primary),
    width: Math.max(1, Math.min(16384, Number(monitor?.width) || 1)),
    height: Math.max(1, Math.min(16384, Number(monitor?.height) || 1))
  }));
}

export function monitorListsEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((monitor, index) => {
    const other = b[index] || {};
    return (
      monitor.id === other.id &&
      monitor.name === other.name &&
      monitor.primary === other.primary &&
      monitor.width === other.width &&
      monitor.height === other.height
    );
  });
}

export function decodeFrame(dataUrl, maxFrameBytes) {
  const match = String(dataUrl || "").match(/^data:image\/jpeg;base64,([a-z0-9+/=]+)$/i);
  if (!match) throw publicError("O quadro de tela precisa ser uma imagem JPEG valida.");
  const bytes = Buffer.byteLength(match[1], "base64");
  if (!bytes || bytes > maxFrameBytes) {
    throw publicError("O quadro de tela excede o limite permitido.", 413);
  }
  const hash = createHash("sha1").update(match[1]).digest("hex");
  return { dataUrl: String(dataUrl), bytes, hash };
}

export function canManageSession(user, session) {
  return Boolean(
    user &&
      session &&
      (session.technicianUserId === user.id || hasPermission(user, "remote_assistance.manage"))
  );
}
