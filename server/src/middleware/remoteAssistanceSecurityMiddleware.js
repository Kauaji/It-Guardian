/** @import { NextFunction, Request, Response } from "express" */

/**
 * Impede cache de respostas da assistencia remota (quadros de tela, eventos, chat).
 *
 * @param {Request} _req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function protectRemoteAssistanceResponse(_req, res, next) {
  res.set({
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff"
  });
  next();
}
