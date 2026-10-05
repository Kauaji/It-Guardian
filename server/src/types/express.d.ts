// Campos que os middlewares do IT Guardian acrescentam ao `Request` do Express.
// Mantenha esta lista em sincronia com `requestContext` e `authMiddleware`.
export {};

declare global {
  namespace Express {
    interface Request {
      /** Definido por `requestContext` (aceita `x-request-id` seguro ou gera um UUID). */
      requestId?: string;
    }
  }
}
