import { isRemoteAssistanceFrameStale, isRemoteAssistanceTerminal } from "../remoteAssistanceModel.js";

// Valores derivados (puros) do estado do atendimento remoto.

export function getUnavailableTitle({ frontendEnabled, canView, canStart, eligible, config }) {
  if (!frontendEnabled) return "Atendimento remoto nao habilitado";
  if (!canView || !canStart) return "Sem permissao para atendimento remoto";
  if (!eligible) return "Agente offline ou sem contato recente";
  if (config?.enabled === false) return "Atendimento remoto indisponivel";
  return "Verificando atendimento remoto";
}

export function getMonitorState(session) {
  const monitors = Array.isArray(session?.monitors) ? session.monitors : [];
  const selectedMonitor =
    monitors.find((monitor) => monitor.id === (session?.selectedMonitorId || monitors[0]?.id)) ||
    monitors[0] ||
    null;
  const screenAspectRatio =
    selectedMonitor?.width && selectedMonitor?.height
      ? `${selectedMonitor.width} / ${selectedMonitor.height}`
      : "16 / 9";
  return { monitors, selectedMonitor, screenAspectRatio };
}

// O controle so esta ativo com a opcao de front ligada, sessao ativa, controle
// liberado no agente, consentimento do usuario local e modo "control" pedido.
export function isControlActive({ frontendControlEnabled, session, requestedMode }) {
  return Boolean(
    frontendControlEnabled &&
      session?.status === "active" &&
      session?.remoteControlEnabled &&
      session?.controlConsentGranted &&
      requestedMode === "control"
  );
}

export function getSessionFlags({ session, metrics, viewerPollMs, error }) {
  const terminal = isRemoteAssistanceTerminal(session?.status);
  const paused = Boolean(session?.paused);
  const connectionState = session?.connectionState || session?.status;
  const frameStale = Boolean(
    session?.status === "active" && !paused && isRemoteAssistanceFrameStale(metrics, viewerPollMs)
  );
  const canReconnect = Boolean(
    session?.id &&
      !terminal &&
      (connectionState === "reconnecting" || connectionState === "agent_offline" || Boolean(error))
  );
  return {
    terminal,
    paused,
    connectionState,
    frameStale,
    canReconnect,
    isWebrtc: session?.transport === "webrtc",
    isRustdesk: session?.transport === "rustdesk"
  };
}
