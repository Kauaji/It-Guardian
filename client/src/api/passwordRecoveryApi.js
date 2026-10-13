// Recuperacao de senha por e-mail. Fica separado de identityApi.js de proposito: so as telas carregadas
// sob demanda (esqueci a senha, link do e-mail, botao do administrador) usam estas chamadas, entao elas
// nao devem pesar no bundle de entrada (orcamento em scripts/check-bundle-budget.mjs).
import { identityRequest } from "./identityApi.js";

/** Diz se o servidor consegue enviar e-mail: `{ passwordReset: { enabled } }`. */
export function fetchAuthOptions() {
  return identityRequest("/auth/options");
}

/** Pede o link de redefinicao. A resposta e sempre neutra (nao revela se o e-mail existe). */
/**
 * @param {string} email
 */
export function requestPasswordReset(email) {
  return identityRequest("/auth/password/forgot", { method: "POST", body: { email } });
}

/** Conclui a redefinicao com o token do link. O token vai no corpo, nunca na URL. */
/**
 * @param {string} token
 * @param {string} newPassword
 */
export function resetPassword(token, newPassword) {
  return identityRequest("/auth/password/reset", { method: "POST", body: { token, newPassword } });
}

/** O administrador envia o link de redefinicao por e-mail. Devolve `{ sent: true }`. */
/**
 * @param {string} token
 * @param {string} userId
 */
export function adminSendResetLink(token, userId) {
  return identityRequest(`/users/${encodeURIComponent(userId)}/send-reset-link`, { token, method: "POST" });
}
