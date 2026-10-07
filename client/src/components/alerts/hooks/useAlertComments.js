import { useState } from "react";

// Rascunhos de comentarios internos por aviso e envio pelo contexto. O retorno
// segue o formato `commentBox` esperado pelos componentes de comentarios.
export default function useAlertComments({ canComment, onAddAlertComment }) {
  const [drafts, setDrafts] = useState({});

  function onChange(alertId, value) {
    setDrafts((current) => ({ ...current, [alertId]: value }));
  }

  async function onSubmit(alertId) {
    const message = String(drafts[alertId] || "").trim();
    if (!message || !onAddAlertComment) return;
    await onAddAlertComment(alertId, message);
    setDrafts((current) => ({ ...current, [alertId]: "" }));
  }

  return { canComment, drafts, onChange, onSubmit };
}
