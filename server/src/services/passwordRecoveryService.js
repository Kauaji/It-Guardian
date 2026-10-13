import { getFrontendUrl } from "../config/environment.js";
import { buildPasswordChangedEmail, buildPasswordResetEmail } from "../domain/accountEmails.js";
import { generateActionToken, hashActionToken, isPlausibleActionToken, resolveActionTokenTtlMinutes } from "../domain/actionToken.js";
import { assertValidPassword } from "../domain/passwordPolicy.js";
import { badRequest, conflict, notFoundError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import {
  claimActionToken,
  countRecentActionTokens,
  invalidateUserActionTokens,
  issueActionToken,
  peekActionToken
} from "../repositories/actionTokenRepository.js";
import { findUserByEmail, findUserById } from "../repositories/userRepository.js";
import { setUserPassword } from "../repositories/userSecurityRepository.js";
import { hashPassword, verifyPassword } from "../security/passwordHasher.js";
import { auditAuth } from "./authService.js";
import { isMailEnabled, sendMail } from "./mailService.js";
import { revokeAllSessions } from "./sessionService.js";

/** @import { RequestContext } from "../types/identity.js" */

export const PASSWORD_RESET_PURPOSE = "password_reset";

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}$/;
// No maximo 3 links por conta por hora: impede usar o sistema para inundar a caixa de alguem.
const MAX_LINKS_PER_HOUR = 3;
// Piso de tempo de resposta: quem existe e quem nao existe demoram parecido (nao revela contas).
const MIN_RESPONSE_MS = 350;

const NEUTRAL_MESSAGE = "Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha. Ele vale por pouco tempo.";

function invalidTokenError() {
  return badRequest("Este link de redefinição é inválido ou expirou. Peça um novo link.", { code: "RESET_TOKEN_INVALID" });
}

/** @param {number} startedAt */
async function padResponseTime(startedAt) {
  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

/** @returns {{ passwordReset: { enabled: boolean } }} */
export function getPasswordResetOptions() {
  return { passwordReset: { enabled: isMailEnabled() } };
}

/**
 * Cria o token e envia o e-mail. A URL base vem da configuracao (nunca de cabecalhos da requisicao):
 * um `Host` forjado nao pode apontar o link para outro site. O token vai no fragmento (#), que o navegador
 * nao envia ao servidor nem em `Referer`.
 *
 * @param {{ id: string, name: string, email: string }} user
 * @param {{ requestedIp?: string | null, createdBy?: string | null }} origin
 * @returns {Promise<void>}
 */
async function issueAndSendResetLink(user, { requestedIp = null, createdBy = null }) {
  const ttlMinutes = resolveActionTokenTtlMinutes(process.env.PASSWORD_RESET_TTL_MINUTES);
  const { token, tokenHash } = generateActionToken();
  await issueActionToken({ userId: user.id, purpose: PASSWORD_RESET_PURPOSE, tokenHash, ttlMinutes, requestedIp, createdBy });
  const link = `${getFrontendUrl()}/redefinir-senha#token=${token}`;
  try {
    await sendMail({ to: user.email, ...buildPasswordResetEmail({ name: user.name, link, ttlMinutes }) });
  } catch (error) {
    await invalidateUserActionTokens(user.id, PASSWORD_RESET_PURPOSE);
    throw error;
  }
}

/**
 * Pedido publico de "esqueci minha senha". A resposta e sempre a mesma (existe ou nao, ativa ou nao,
 * com ou sem e-mail configurado), para nao revelar quais contas existem.
 *
 * @param {unknown} emailInput
 * @param {RequestContext} [context]
 * @returns {Promise<{ message: string }>}
 */
export async function requestPasswordReset(emailInput, context = {}) {
  const startedAt = Date.now();
  const email = String(emailInput || "")
    .trim()
    .toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw badRequest("Informe um e-mail válido.", { code: "INVALID_EMAIL" });

  const user = isMailEnabled() ? await findUserByEmail(email) : null;
  if (!user || user.active === false) {
    await auditAuth("auth_password_reset_requested", "Pedido de redefinição sem conta ativa ou sem e-mail configurado.", null, context, {
      delivered: false
    });
  } else if ((await countRecentActionTokens(user.id, PASSWORD_RESET_PURPOSE, 60)) >= MAX_LINKS_PER_HOUR) {
    await auditAuth("auth_password_reset_requested", "Pedido de redefinição limitado (muitos links na última hora).", user.id, context, {
      delivered: false,
      throttled: true
    });
  } else {
    try {
      await issueAndSendResetLink(user, { requestedIp: context.ip || null });
      await auditAuth("auth_password_reset_requested", "Link de redefinição de senha enviado por e-mail.", user.id, context, {
        delivered: true
      });
    } catch (error) {
      logger.warn("password_reset_mail_failed", { message: error instanceof Error ? error.message : String(error) });
      await auditAuth("auth_password_reset_requested", "Falha ao enviar o e-mail de redefinição.", user.id, context, { delivered: false });
    }
  }

  await padResponseTime(startedAt);
  return { message: NEUTRAL_MESSAGE };
}

/**
 * Conclui a redefinicao. A senha nova e validada ANTES de gastar o link (uma senha fraca nao queima o token);
 * o consumo em si e atomico. Nao abre sessao: a pessoa entra normalmente depois, passando pelo MFA se tiver.
 *
 * @param {{ token?: unknown, newPassword?: unknown }} input
 * @param {RequestContext} [context]
 * @returns {Promise<{ ok: true }>}
 */
export async function resetPasswordWithToken({ token, newPassword }, context = {}) {
  if (!isPlausibleActionToken(token)) throw invalidTokenError();
  const tokenHash = hashActionToken(token);

  const found = await peekActionToken(tokenHash, PASSWORD_RESET_PURPOSE);
  const user = found ? await findUserById(found.userId) : null;
  if (!user || user.active === false) {
    await auditAuth("auth_password_reset_failed", "Link de redefinição inválido, expirado ou já usado.", null, context);
    throw invalidTokenError();
  }

  assertValidPassword(newPassword, { email: user.email, name: user.name });
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw badRequest("A nova senha precisa ser diferente da atual.", { code: "PASSWORD_REUSED" });
  }

  const claimed = await claimActionToken(tokenHash, PASSWORD_RESET_PURPOSE);
  if (!claimed) throw invalidTokenError();

  await setUserPassword(user.id, await hashPassword(String(newPassword)), { mustChangePassword: false });
  await revokeAllSessions(user.id, "password_reset");
  await invalidateUserActionTokens(user.id, PASSWORD_RESET_PURPOSE);
  await auditAuth("auth_password_reset_completed", "Senha redefinida pelo link enviado por e-mail.", user.id, context);

  if (isMailEnabled()) {
    try {
      await sendMail({ to: user.email, ...buildPasswordChangedEmail({ name: user.name }) });
    } catch (error) {
      logger.warn("password_changed_notice_failed", { message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { ok: true };
}

/**
 * O administrador manda o link de redefinicao por e-mail (alternativa a senha temporaria: a pessoa escolhe a propria).
 *
 * @param {string} targetUserId
 * @param {{ id: string }} actingUser
 * @param {RequestContext} [context]
 * @returns {Promise<{ sent: true }>}
 */
export async function sendResetLinkByAdmin(targetUserId, actingUser, context = {}) {
  if (!isMailEnabled()) {
    throw conflict("O envio de e-mail não está configurado neste servidor. Use a senha temporária.", { code: "MAIL_NOT_CONFIGURED" });
  }
  const target = await findUserById(targetUserId);
  if (!target) throw notFoundError("Usuário não encontrado.");
  if (target.active === false) throw conflict("A conta está inativa.", { code: "USER_INACTIVE" });

  try {
    await issueAndSendResetLink(target, { requestedIp: context.ip || null, createdBy: actingUser.id });
  } catch (error) {
    logger.warn("password_reset_mail_failed", { message: error instanceof Error ? error.message : String(error) });
    throw conflict("Não foi possível enviar o e-mail agora. Tente novamente em instantes.", { code: "MAIL_SEND_FAILED" });
  }
  await auditAuth(
    "auth_password_reset_sent_by_admin",
    `Link de redefinição enviado a ${target.email} por administrador.`,
    actingUser.id,
    context,
    {
      targetUserId
    }
  );
  return { sent: true };
}
