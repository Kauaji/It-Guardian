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
