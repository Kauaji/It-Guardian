/** @import { Request, Response } from "express" */
import { getAuthConfig, isProductionLike } from "../config/environment.js";

// O prefixo __Host- obriga o navegador a aceitar o cookie so com Secure,
// Path=/ e sem Domain: um subdominio comprometido nao consegue sobrescreve-lo.
// Fora de producao (HTTP local) o nome simples continua valendo.
export const sessionCookieName = isProductionLike ? "__Host-it_guardian_session" : "it_guardian_session";

/** @param {string | undefined} [header] Valor do cabecalho `Cookie`. */
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
    }, /** @type {Record<string, string>} */ ({}));
}

/** @param {number} maxAgeSeconds */
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

/**
 * @param {Pick<Request, "headers">} req
 * @returns {string} Token da sessao ou "" quando ausente.
 */
export function readSessionCookie(req) {
  return parseCookies(req.headers.cookie)[sessionCookieName] || "";
}

/**
 * @param {Pick<Response, "setHeader">} res
 * @param {string} token
 * @param {number} [maxAgeSeconds]
 */
export function setSessionCookie(res, token, maxAgeSeconds = getAuthConfig().idleSeconds) {
  const attributes = cookieAttributes(maxAgeSeconds);
  attributes[0] = `${sessionCookieName}=${encodeURIComponent(token)}`;
  res.setHeader("Set-Cookie", attributes.join("; "));
}

/** @param {Pick<Response, "setHeader">} res */
export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", cookieAttributes(0).join("; "));
}
