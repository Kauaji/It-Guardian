import { useCallback, useEffect, useState } from "react";
import {
  createRemoteAssistanceSession,
  endRemoteAssistanceSession,
  fetchRemoteAssistanceEvents,
  fetchRemoteAssistanceSession,
  updateRemoteAssistanceCapture
} from "../../../api.js";
import { isRemoteAssistanceTerminal } from "../remoteAssistanceModel.js";
import { notifyResult } from "../utils/notify.js";

const SESSION_POLL_MS = 1200;

// Sessao de assistencia: criacao, polling de estado/auditoria, pausa e
// encerramento. `error` e `submitting` sao compartilhados com os demais hooks
// (viewer, chat, controle), que reportam falhas por `setError`/`perform`.
export function useRemoteAssistanceSession({ open, token, notify }) {
  const [session, setSession] = useState(null);
  const [viewerToken, setViewerToken] = useState("");
  const [events, setEvents] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const terminal = isRemoteAssistanceTerminal(session?.status);

  const refreshSession = useCallback(async () => {
    if (!session?.id || !token) return;
    try {
      const [sessionResult, eventResult] = await Promise.all([
        fetchRemoteAssistanceSession({ token, sessionId: session.id }),
        fetchRemoteAssistanceEvents({ token, sessionId: session.id })
      ]);
      setSession(sessionResult.session);
      if (sessionResult.session?.metrics) setMetrics(sessionResult.session.metrics);
      setEvents(Array.isArray(eventResult.events) ? eventResult.events : []);
      setError("");
    } catch (refreshError) {
      setError(refreshError.message);
    }
  }, [session?.id, token]);

  useEffect(() => {
    if (!open || !session?.id || terminal) return undefined;
    refreshSession();
    const sessionTimer = window.setInterval(refreshSession, SESSION_POLL_MS);
    return () => window.clearInterval(sessionTimer);
  }, [open, refreshSession, session?.id, terminal]);

  // Se o login do tecnico expira, a sessao remota nao pode ficar aberta.
  useEffect(() => {
    if (!session?.id || terminal) return undefined;
    const handleAuthExpired = () => {
      endRemoteAssistanceSession({ token, sessionId: session.id, viewerToken }).catch(() => {});
    };
    window.addEventListener("it-guardian:auth-expired", handleAuthExpired);
    return () => window.removeEventListener("it-guardian:auth-expired", handleAuthExpired);
  }, [session?.id, terminal, token, viewerToken]);

  // Executa uma acao do tecnico marcando `submitting` e reportando a falha.
  const perform = useCallback(async (action) => {
    setSubmitting(true);
    try {
      await action();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const start = useCallback(
    async ({ reauthenticate, assetId, serviceOrderId, reason, requestedMode, onFinished }) => {
      setSubmitting(true);
      setError("");
      try {
        const reauthenticationToken = await reauthenticate();
        const result = await createRemoteAssistanceSession({
          token,
          assetId,
          serviceOrderId,
          reason,
          requestedMode,
          reauthenticationToken
        });
        onFinished?.();
        setSession(result.session);
        setViewerToken(result.viewerToken);
        notifyResult(notify, "Solicitação enviada ao usuário da máquina.");
      } catch (startError) {
        onFinished?.();
        setError(startError.message);
      } finally {
        setSubmitting(false);
      }
    },
    [notify, token]
  );

  const end = useCallback(
    async ({ onEnded } = {}) => {
      if (!session?.id || !viewerToken) return;
      setSubmitting(true);
      try {
        const result = await endRemoteAssistanceSession({ token, sessionId: session.id, viewerToken });
        setSession(result.session);
        onEnded?.();
        notifyResult(notify, "Atendimento remoto encerrado.");
      } catch (endError) {
        setError(endError.message);
      } finally {
        setSubmitting(false);
      }
    },
    [notify, session?.id, token, viewerToken]
  );

  const togglePause = useCallback(
    () =>
      perform(async () => {
        const result = await updateRemoteAssistanceCapture({
          token,
          sessionId: session.id,
          viewerToken,
          paused: !session?.paused
        });
        setSession(result.session);
      }),
    [perform, session?.id, session?.paused, token, viewerToken]
  );

  const reset = useCallback(() => {
    setSession(null);
    setViewerToken("");
    setEvents([]);
    setMetrics(null);
    setError("");
  }, []);

  return {
    session,
    setSession,
    viewerToken,
    events,
    metrics,
    setMetrics,
    submitting,
    error,
    setError,
    terminal,
    refreshSession,
    perform,
    start,
    end,
    togglePause,
    reset
  };
}
