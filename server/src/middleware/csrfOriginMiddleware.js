/** @import { NextFunction, Request, Response } from "express" */
import { getCorsOrigins, isAllowedVercelOrigin } from "../config/environment.js";
import { readSessionCookie } from "../security/sessionCookie.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Bloqueia escrita autenticada so por cookie quando o `Origin` nao e confiavel (CSRF).
 *
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function requireTrustedCookieOrigin(req, res, next) {
  if (safeMethods.has(req.method) || req.headers.authorization || !readSessionCookie(req)) {
    return next();
  }

  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (origin && (getCorsOrigins().includes(origin) || isAllowedVercelOrigin(origin))) {
    return next();
  }

  return res.status(403).json({ message: "Origem da requisicao nao autorizada." });
}
