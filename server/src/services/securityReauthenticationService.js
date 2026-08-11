import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getRemoteAssistanceConfig } from "../config/environment.js";
import { assertRemoteAssistanceEnabled } from "../domain/remoteAssistancePolicy.js";
import { findAgentAssetById } from "../repositories/agentRepository.js";
import {
  addSecurityReauthenticationAttempt,
  createSecurityReauthentication
} from "../repositories/securityReauthenticationRepository.js";
import { findServiceOrderById } from "../repositories/serviceOrderRepository.js";
import { findUserById } from "../repositories/userRepository.js";

export const remoteAssistanceReauthenticationAction = "remote_assistance_start";

function publicError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

export function hashSecurityToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export async function reauthenticateForRemoteAssistance({
  user,
  password,
  action,
  assetId,
  serviceOrderId = null,
  requestIp = null,
  userAgent = null
}) {
  const config = getRemoteAssistanceConfig();
  assertRemoteAssistanceEnabled(config);

  const normalizedAction = String(action || "").trim();
  const normalizedAssetId = String(assetId || "").trim();
  const normalizedServiceOrderId = String(serviceOrderId || "").trim() || null;

  if (normalizedAction !== remoteAssistanceReauthenticationAction) {
    throw publicError("Finalidade de reautenticacao invalida.");
  }
  if (!normalizedAssetId) {
    throw publicError("Selecione a maquina antes de confirmar sua senha.");
  }

  const [storedUser, asset] = await Promise.all([
    findUserById(user?.id),
    findAgentAssetById(normalizedAssetId)
  ]);
  if (!storedUser || storedUser.active === false) {
    throw publicError("Usuario autenticado nao encontrado.", 401);
  }
  if (!asset) {
    throw publicError("Maquina monitorada nao encontrada.", 404);
  }

  if (normalizedServiceOrderId) {
    const serviceOrder = await findServiceOrderById(normalizedServiceOrderId, user);
    if (!serviceOrder) throw publicError("Ordem de servico nao encontrada.", 404);
    if (serviceOrder.assetId && serviceOrder.assetId !== normalizedAssetId) {
      throw publicError("A ordem de servico nao pertence a maquina selecionada.", 409);
    }
  }

  const succeeded = await bcrypt.compare(String(password || ""), storedUser.passwordHash);
  await addSecurityReauthenticationAttempt({
    userId: storedUser.id,
    action: normalizedAction,
    assetId: normalizedAssetId,
    serviceOrderId: normalizedServiceOrderId,
    succeeded,
    requestIp,
    userAgent
  });
  if (!succeeded) {
    throw publicError("Senha incorreta.", 401);
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.reauthTtlMinutes * 60 * 1000);
  const reauthentication = await createSecurityReauthentication({
    userId: storedUser.id,
    action: normalizedAction,
    assetId: normalizedAssetId,
    serviceOrderId: normalizedServiceOrderId,
    tokenHash: hashSecurityToken(token),
    expiresAt
  });

  return {
    token,
    action: reauthentication.action,
    assetId: reauthentication.asset_id,
    serviceOrderId: reauthentication.service_order_id,
    expiresAt: reauthentication.expires_at
  };
}
