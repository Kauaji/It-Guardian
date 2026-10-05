import { useCallback, useEffect, useState } from "react";
import { fetchRemoteAssistanceFrame, selectRemoteAssistanceMonitor } from "../../../api.js";
import { toFrameSrc } from "../utils/frame.js";

// Visor por snapshots: polling de quadros, latencia, metricas, troca de
// monitor e reconexao manual. O chat chega junto dos quadros (onChatMessages).
export function useRemoteViewer({
  open,
  token,
  session,
  viewerToken,
  viewerPollMs,
  setSession,
  setMetrics,
  setError,
  onChatMessages,
  refreshSession
}) {
  const [frame, setFrame] = useState(null);
  const [latency, setLatency] = useState(null);
  const [changingMonitor, setChangingMonitor] = useState(false);

  const refreshFrame = useCallback(async () => {
    if (!session?.id || !viewerToken || session.status !== "active" || session.paused) return;
    try {
      const startedAt = performance.now();
      const result = await fetchRemoteAssistanceFrame({
        token,
        sessionId: session.id,
        viewerToken
      });
      setLatency(Math.max(0, Math.round(performance.now() - startedAt)));
      if (result.metrics) setMetrics(result.metrics);
      if (Array.isArray(result.chatMessages)) onChatMessages(result.chatMessages);
      if (result.frame) setFrame(toFrameSrc(result.frame));
    } catch (frameError) {
      setError(frameError.message);
    }
  }, [onChatMessages, session?.id, session?.paused, session?.status, setError, setMetrics, token, viewerToken]);

  useEffect(() => {
    if (!open || session?.status !== "active" || session?.paused) return undefined;
    refreshFrame();
    const frameTimer = window.setInterval(refreshFrame, viewerPollMs);
    return () => window.clearInterval(frameTimer);
  }, [open, refreshFrame, session?.paused, session?.status, viewerPollMs]);

  const changeMonitor = useCallback(
    async (monitorId) => {
      setChangingMonitor(true);
      setFrame(null);
      try {
        const result = await selectRemoteAssistanceMonitor({
          token,
          sessionId: session.id,
          viewerToken,
          monitorId
        });
        setSession(result.session);
      } catch (monitorError) {
        setError(monitorError.message);
      } finally {
        setChangingMonitor(false);
      }
    },
    [session?.id, setError, setSession, token, viewerToken]
  );

  const reconnect = useCallback(async () => {
    setError("");
    await refreshSession();
    await refreshFrame();
  }, [refreshFrame, refreshSession, setError]);

  const clearFrame = useCallback(() => setFrame(null), []);

  return { frame, latency, changingMonitor, changeMonitor, reconnect, clearFrame };
}
