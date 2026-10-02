import { buildOtpauthUri, generateRecoveryCode, generateTotpSecret, verifyTotp } from "../domain/totp.js";
import { badRequest, conflict, forbidden, unauthorized } from "../lib/errors.js";
import { getAuthConfig } from "../config/environment.js";
import { findUserById } from "../repositories/userRepository.js";
import {
  activateMfa,
  claimMfaStep,
  consumeRecoveryCode,
  countUnusedRecoveryCodes,
  deactivateMfa,
  getSecurityState,
  replaceRecoveryCodes,
  saveMfaPendingSecret
} from "../repositories/userSecurityRepository.js";
import { openSecret, sealSecret } from "../security/secretBox.js";
import { verifyPassword } from "../security/passwordHasher.js";
import { auditAuth, hashRecoveryCode } from "./authService.js";
import { revokeAllSessions } from "./sessionService.js";

const RECOVERY_CODE_COUNT = 10;

async function loadUser(userId) {
  const user = await findUserById(userId);
  if (!user) throw unauthorized("Sessão inválida.");
  return user;
}

async function issueRecoveryCodes(userId) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
  await replaceRecoveryCodes(userId, codes.map(hashRecoveryCode));
  return codes;
}

export async function getMfaStatus(userId) {
  const user = await loadUser(userId);
  return {
    enabled: Boolean(user.mfaEnabled),
    requiredForAdmins: getAuthConfig().mfaRequiredForAdmins,
    recoveryCodesLeft: user.mfaEnabled ? await countUnusedRecoveryCodes(userId) : 0
  };
}

/** Passo 1: gera um segredo pendente. So passa a valer depois de confirmado com um codigo. */
export async function beginMfaSetup(userId) {
  const user = await loadUser(userId);
  if (user.mfaEnabled) throw conflict("A verificação em duas etapas já está ativa.", { code: "MFA_ALREADY_ENABLED" });
  const secret = generateTotpSecret();
  await saveMfaPendingSecret(userId, sealSecret(secret));
  return { secret, otpauthUri: buildOtpauthUri({ secret, accountName: user.email }) };
}

/** Passo 2: confirma com um codigo do app, ativa o MFA e devolve os codigos de recuperacao (uma unica vez). */
export async function confirmMfaSetup(userId, code, context = {}) {
  const state = await getSecurityState(userId);
  if (!state?.mfaPendingSecretEncrypted) {
    throw badRequest("Inicie a configuração antes de confirmar.", { code: "MFA_SETUP_NOT_STARTED" });
  }
  const step = verifyTotp(openSecret(state.mfaPendingSecretEncrypted), code);
  if (step === null) throw badRequest("Código inválido. Confira o horário do aparelho e tente de novo.", { code: "MFA_CODE_INVALID" });

  await activateMfa(userId, { lastUsedStep: step });
  const recoveryCodes = await issueRecoveryCodes(userId);
  await auditAuth("auth_mfa_enabled", "Verificação em duas etapas ativada.", userId, context);
  return { recoveryCodes };
}

async function assertSecondFactor(userId, { password, code, recoveryCode }) {
  const user = await loadUser(userId);
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw unauthorized("A senha está incorreta.", { code: "CURRENT_PASSWORD_INVALID" });
  }
  const state = await getSecurityState(userId);
  if (recoveryCode) {
    if (!(await consumeRecoveryCode(userId, hashRecoveryCode(recoveryCode)))) {
      throw unauthorized("Código de recuperação inválido.", { code: "MFA_CODE_INVALID" });
    }
    return user;
  }
  const step = state?.mfaSecretEncrypted
    ? verifyTotp(openSecret(state.mfaSecretEncrypted), code, { lastUsedStep: state.mfaLastUsedStep })
    : null;
  if (step === null || !(await claimMfaStep(userId, step))) {
    throw unauthorized("Código de verificação inválido.", { code: "MFA_CODE_INVALID" });
  }
  return user;
}

export async function disableMfa(userId, credentials, context = {}) {
  const user = await loadUser(userId);
  if (!user.mfaEnabled) throw conflict("A verificação em duas etapas não está ativa.", { code: "MFA_NOT_ENABLED" });
  if (user.isAdmin && getAuthConfig().mfaRequiredForAdmins) {
    throw forbidden("A verificação em duas etapas é obrigatória para administradores.", { code: "MFA_REQUIRED" });
  }
  await assertSecondFactor(userId, credentials);
  await deactivateMfa(userId);
  await auditAuth("auth_mfa_disabled", "Verificação em duas etapas desativada.", userId, context);
}

export async function regenerateRecoveryCodes(userId, credentials, context = {}) {
  const user = await loadUser(userId);
  if (!user.mfaEnabled) throw conflict("Ative a verificação em duas etapas primeiro.", { code: "MFA_NOT_ENABLED" });
  await assertSecondFactor(userId, credentials);
  const recoveryCodes = await issueRecoveryCodes(userId);
  await auditAuth("auth_recovery_codes_regenerated", "Códigos de recuperação regenerados.", userId, context);
  return { recoveryCodes };
}

/** Administrador remove o MFA de alguem que perdeu o aparelho e os codigos de recuperacao. */
export async function adminResetMfa(targetUserId, actingUser, context = {}) {
  const target = await loadUser(targetUserId);
  await deactivateMfa(targetUserId);
  await revokeAllSessions(targetUserId, "mfa_reset_by_admin");
  await auditAuth("auth_mfa_reset_by_admin", `MFA de ${target.email} removido por administrador.`, actingUser.id, context, {
    targetUserId
  });
}
