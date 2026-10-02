/** Visao publica de um trabalho entregue ao agente (nunca expoe hash nem solicitante). */
export function publicJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    scriptId: row.script_id,
    name: row.script_name || "Script de manutencao",
    type: row.script_type,
    content: row.script_content,
    timeoutSeconds: Number(row.timeout_seconds || 120),
    requiresAdmin: row.requires_admin === true,
    requiresLoggedUser: row.requires_logged_user === true
  };
}
