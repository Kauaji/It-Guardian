import { isProductionLike } from "../config/environment.js";

export const sessionCookieName = "it_guardian_session";

function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return cookies;
      const key = decodeURIComponent(part.slice(0, separator));
      const value = decodeURIComponent(part.slice(separator + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

function cookieAttributes(maxAgeSeconds) {
  return [
    `${sessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    isProductionLike ? "Secure" : "",
    `Max-Age=${maxAgeSeconds}`
  ].filter(Boolean);
}

export function readSessionCookie(req) {
  return parseCookies(req.headers.cookie)[sessionCookieName] || "";
}

export function setSessionCookie(res, token) {
  const maxAgeSeconds = Math.max(300, Number(process.env.SESSION_MAX_AGE_SECONDS || 28_800));
  const attributes = cookieAttributes(maxAgeSeconds);
  attributes[0] = `${sessionCookieName}=${encodeURIComponent(token)}`;
  res.setHeader("Set-Cookie", attributes.join("; "));
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", cookieAttributes(0).join("; "));
}
