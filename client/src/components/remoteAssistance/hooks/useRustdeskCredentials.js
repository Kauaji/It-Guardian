import { useCallback, useState } from "react";
import { fetchRemoteAssistanceRustdeskCredentials } from "../../../api.js";
import { notifyResult } from "../utils/notify.js";

// Credenciais RustDesk da sessao. Ficam so no estado do React (nunca em
// storage, URL ou console) e so sao buscadas sob demanda.
export function useRustdeskCredentials({ token, session, viewerToken, notify }) {
  const [credentials, setCredentials] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState("");

  /**
   * Revela id + senha de sessao do RustDesk. So chamado sob demanda (nunca
   * automaticamente): cada chamada fica registrada na auditoria do backend
   * (evento "rustdesk_credentials_revealed"), entao reabrir o painel sem
   * necessidade gera ruido na trilha de auditoria da maquina.
   */
  const reveal = useCallback(async () => {
    if (!session?.id || !viewerToken) return;
    setRevealing(true);
    setError("");
    try {
      const result = await fetchRemoteAssistanceRustdeskCredentials({
        token,
        sessionId: session.id,
        viewerToken
      });
      setCredentials(result);
    } catch (credentialsError) {
      setCredentials(null);
      setError(credentialsError.message);
    } finally {
      setRevealing(false);
    }
  }, [session?.id, token, viewerToken]);

  const copy = useCallback(
    async (value, label) => {
      try {
        await navigator.clipboard.writeText(value);
        notifyResult(notify, `${label} copiado.`);
      } catch {
        setError(`Nao foi possivel copiar ${label.toLowerCase()} automaticamente. Copie manualmente.`);
      }
    },
    [notify]
  );

  // Oculta as credenciais (ao encerrar a sessao).
  const clear = useCallback(() => setCredentials(null), []);

  const reset = useCallback(() => {
    setCredentials(null);
    setError("");
  }, []);

  return { credentials, revealing, error, reveal, copy, clear, reset };
}
