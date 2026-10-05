// Eventos globais de identidade. `auth-expired` leva ao login (tratado em
// useAppSessionController); `account-restricted` avisa que o servidor exigiu
// troca de senha ou cadastro de MFA (tratado em components/auth/AccountGate).
export const AUTH_EXPIRED_EVENT = "it-guardian:auth-expired";
export const ACCOUNT_RESTRICTED_EVENT = "it-guardian:account-restricted";
export const SESSION_EXPIRED_MESSAGE = "Sua sessão expirou. Entre novamente.";

const tokenKey = "it_guardian_token";
const userKey = "it_guardian_user";

export function readAuthSession() {
  return { token: null, user: null };
}

export function writeAuthSession() {
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(userKey);
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
}

export function clearAuthSession() {
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(userKey);
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
}
