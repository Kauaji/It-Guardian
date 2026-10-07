import { auditAuth } from "./authService.js";
import { endRemoteAssistanceSessionsOnLogout } from "./remoteAssistanceService.js";
import { revokeSession } from "./sessionService.js";

/**
 * Logout: revoga a sessao, encerra as assistencias remotas do tecnico e audita.
 * Fica fora de `authService` para o nucleo de identidade nao depender da
 * assistencia remota (e para o `tsc` poder cobri-lo sem seguir esse fecho).
 */
export async function endSessionOnLogout(user, sessionId, context = {}) {
  if (sessionId) await revokeSession(sessionId, user.id, "logout");
  await endRemoteAssistanceSessionsOnLogout(user);
  await auditAuth("auth_logout", "Logout realizado.", user.id, context);
}
