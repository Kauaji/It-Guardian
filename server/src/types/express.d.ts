// Campos que os middlewares do IT Guardian acrescentam ao `Request` do Express.
// Mantenha esta lista em sincronia com `requestContext` e `authMiddleware`.
import type { RequestAuth, RequestUser } from "./identity.js";

export {};

declare global {
  namespace Express {
    interface Request {
      /** Definido por `requestContext` (aceita `x-request-id` seguro ou gera um UUID). */
      requestId?: string;
      /** Definido por `requireAuth`: usuario autenticado com os escopos ja carregados. */
      user?: RequestUser;
      /** Definido por `requireAuth`: token, claims e sessao da requisicao. */
      auth?: RequestAuth;
    }
  }
}
