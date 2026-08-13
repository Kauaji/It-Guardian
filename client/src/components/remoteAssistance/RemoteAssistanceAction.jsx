import {
  CheckCircle2,
  Clock3,
  Eye,
  KeyRound,
  MonitorUp,
  MousePointer2,
  Pause,
  Play,
  Power,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createRemoteAssistanceSession,
  endRemoteAssistanceSession,
  fetchRemoteAssistanceConfig,
  fetchRemoteAssistanceEvents,
  fetchRemoteAssistanceFrame,
  fetchRemoteAssistanceSession,
  reauthenticateRemoteAssistance,
  selectRemoteAssistanceMonitor,
  sendRemoteAssistanceInput,
  updateRemoteAssistanceCapture,
  updateRemoteAssistanceControl
} from "../../api.js";
import { hasPermission } from "../../permissions.js";
import {
  canShowRemoteAssistanceAction,
  formatBytesPerSecond,
  formatFrameSize,
  formatRemoteMonitor,
  getRemoteAssetDisplayName,
  getRemoteAssetLastSeenAt,
  hasRemoteAssistanceAgent,
  isRemoteAssistanceAssetFresh,
  isRemoteAssistanceFrameStale,
  isRemoteAssistanceFrontendEnabled,
  isRemoteAssistanceTerminal,
  remoteAssistanceStatusLabel,
  remoteAssistanceTransportLabel
} from "./remoteAssistanceModel.js";

const defaultViewerPollMs = 1000;

function formatDateTime(value) {
  if (!value) return "Nao informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function notifyResult(notify, message, type = "ok") {
  if (typeof notify === "function") notify(message, type);
}

function RemoteStatus({ session }) {
  const displayState = session?.connectionState || session?.status;
  const denied = session?.status === "consent_denied" || session?.status === "failed";
  const unstable = displayState === "reconnecting" || displayState === "agent_offline";
  const settled = displayState === "active";
  const Icon = denied ? WifiOff : unstable ? RefreshCw : settled ? CheckCircle2 : Clock3;
  return (
    <span className={`remote-assistance-status status-${displayState || "idle"}`}>
      <Icon size={15} className={unstable ? "spin" : undefined} />
      {remoteAssistanceStatusLabel(displayState)}
    </span>
  );
}

export default function RemoteAssistanceAction({
  asset,
  alias,
  serviceOrder = null,
  token,
  user,
  notify,
  compact = false
}) {
  const frontendEnabled = isRemoteAssistanceFrontendEnabled();
  const frontendControlEnabled = import.meta.env.VITE_ENABLE_REMOTE_CONTROL === "true";
  const canView = hasPermission(user, "remote_assistance.view");
  const canStart = hasPermission(user, "remote_assistance.start");
  const canControl = hasPermission(user, "remote_assistance.control");
  const canEnd = hasPermission(user, "remote_assistance.end");
  const [config, setConfig] = useState(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [requestedMode, setRequestedMode] = useState("view");
  const [session, setSession] = useState(null);
  const [viewerToken, setViewerToken] = useState("");
  const [events, setEvents] = useState([]);
  const [frame, setFrame] = useState(null);
  const [latency, setLatency] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [changingMonitor, setChangingMonitor] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef(null);
  const lastMouseMoveRef = useRef(0);

  const eligible = useMemo(
    () => Boolean(asset?.id && isRemoteAssistanceAssetFresh(asset)),
    [asset]
  );
  const visible = canShowRemoteAssistanceAction({
    frontendEnabled,
    canView,
    canStart,
    eligible,
    backendEnabled: config?.enabled
  });
  const renderCompactSlot = Boolean(compact && asset?.id && hasRemoteAssistanceAgent(asset));
  const unavailableTitle = !frontendEnabled
    ? "Atendimento remoto nao habilitado"
    : !canView || !canStart
      ? "Sem permissao para atendimento remoto"
      : !eligible
        ? "Agente offline ou sem contato recente"
        : config?.enabled === false
          ? "Atendimento remoto indisponivel"
          : "Verificando atendimento remoto";
  const displayName = getRemoteAssetDisplayName(asset, alias);
  const monitors = Array.isArray(session?.monitors) ? session.monitors : [];
  const terminal = isRemoteAssistanceTerminal(session?.status);
  const controlActive = Boolean(
    frontendControlEnabled &&
    session?.status === "active" &&
      session?.remoteControlEnabled &&
      session?.controlConsentGranted &&
      requestedMode === "control"
  );
  const viewerPollMs = config?.viewerPollMs || defaultViewerPollMs;
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

  useEffect(() => {
    if (!frontendEnabled || !canView || !canStart || !eligible || !token) return undefined;
    let cancelled = false;
    fetchRemoteAssistanceConfig(token)
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [canStart, canView, eligible, frontendEnabled, token]);

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
      if (result.frame) {
        setFrame(
          result.frame.startsWith("data:image/")
            ? result.frame
            : `data:image/jpeg;base64,${result.frame}`
        );
      }
    } catch (frameError) {
      setError(frameError.message);
    }
  }, [session?.id, session?.paused, session?.status, token, viewerToken]);

  useEffect(() => {
    if (!open || !session?.id || terminal) return undefined;
    refreshSession();
    const sessionTimer = window.setInterval(refreshSession, 1200);
    return () => window.clearInterval(sessionTimer);
  }, [open, refreshSession, session?.id, terminal]);

  useEffect(() => {
    if (!open || session?.status !== "active" || session?.paused) return undefined;
    refreshFrame();
    const frameTimer = window.setInterval(refreshFrame, viewerPollMs);
    return () => window.clearInterval(frameTimer);
  }, [open, refreshFrame, session?.paused, session?.status, viewerPollMs]);

  useEffect(() => {
    if (!session?.id || terminal) return undefined;
    const handleAuthExpired = () => {
      endRemoteAssistanceSession({ token, sessionId: session.id, viewerToken }).catch(() => {});
    };
    window.addEventListener("it-guardian:auth-expired", handleAuthExpired);
    return () => window.removeEventListener("it-guardian:auth-expired", handleAuthExpired);
  }, [session?.id, terminal, token, viewerToken]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function startSession(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const confirmation = await reauthenticateRemoteAssistance({
        token,
        password,
        assetId: asset.id,
        serviceOrderId: serviceOrder?.id
      });
      const result = await createRemoteAssistanceSession({
        token,
        assetId: asset.id,
        serviceOrderId: serviceOrder?.id,
        reason,
        requestedMode,
        reauthenticationToken: confirmation.token
      });
      setPassword("");
      setSession(result.session);
      setViewerToken(result.viewerToken);
      notifyResult(notify, "Solicitacao enviada ao usuario da maquina.");
    } catch (startError) {
      setPassword("");
      setError(startError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function endSession() {
    if (!session?.id || !viewerToken) return;
    setSubmitting(true);
    try {
      const result = await endRemoteAssistanceSession({ token, sessionId: session.id, viewerToken });
      setSession(result.session);
      setFrame(null);
      notifyResult(notify, "Atendimento remoto encerrado.");
    } catch (endError) {
      setError(endError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function closeDialog() {
    if (session?.id && !terminal) {
      const confirmed = window.confirm("Encerrar o atendimento remoto antes de fechar?");
      if (!confirmed) return;
      await endSession();
    }
    setOpen(false);
    setSession(null);
    setViewerToken("");
    setEvents([]);
    setFrame(null);
    setMetrics(null);
    setError("");
    setReason("");
    setPassword("");
    setRequestedMode("view");
  }

  async function changeMonitor(monitorId) {
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
  }

  async function togglePause() {
    setSubmitting(true);
    try {
      const result = await updateRemoteAssistanceCapture({
        token,
        sessionId: session.id,
        viewerToken,
        paused: !paused
      });
      setSession(result.session);
    } catch (pauseError) {
      setError(pauseError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function reconnect() {
    setError("");
    await refreshSession();
    await refreshFrame();
  }

  async function toggleControl() {
    if (!frontendControlEnabled) return;
    setSubmitting(true);
    try {
      const result = await updateRemoteAssistanceControl({
        token,
        sessionId: session.id,
        viewerToken,
        enabled: !session.remoteControlEnabled
      });
      setSession(result.session);
      if (!result.session.remoteControlEnabled) imageRef.current?.blur();
    } catch (controlError) {
      setError(controlError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function sendInput(command) {
    if (!controlActive) return;
    sendRemoteAssistanceInput({ token, sessionId: session.id, viewerToken, command }).catch((inputError) => {
      setError(inputError.message);
    });
  }

  function pointerPosition(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    };
  }

  function handleMouseMove(event) {
    const now = performance.now();
    if (now - lastMouseMoveRef.current < 80) return;
    lastMouseMoveRef.current = now;
    sendInput({ type: "mouse_move", ...pointerPosition(event) });
  }

  function handleMouseButton(event, action) {
    if (!controlActive) return;
    event.preventDefault();
    const button = event.button === 2 ? "right" : event.button === 1 ? "middle" : "left";
    sendInput({ type: "mouse_move", ...pointerPosition(event) });
    sendInput({ type: "mouse_button", button, action });
  }

  function handleKey(event, action) {
    if (!controlActive) return;
    const key = event.key === " " ? "Space" : event.key;
    if (key.length === 1 || [
      "Enter", "Escape", "Backspace", "Tab", "Delete", "Insert", "Home", "End",
      "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"
    ].includes(key)) {
      event.preventDefault();
      sendInput({ type: "key", key, action });
    }
  }

  if (!visible && !renderCompactSlot) return null;

  const dialog = open ? (
    <div className="modal-backdrop remote-assistance-backdrop" role="presentation">
      <section className="remote-assistance-modal" role="dialog" aria-modal="true" aria-label="Assistencia remota">
        <header className="remote-assistance-header">
          <div>
            <span className="asset-eyebrow">Assistencia Remota</span>
            <h2>{displayName}</h2>
            <p>{asset.hostname || asset.name} - {asset.ip || "IP nao informado"}</p>
          </div>
          <button type="button" className="icon-button" onClick={closeDialog} title="Fechar">
            <X size={18} />
          </button>
        </header>

        {!session ? (
          <form className="remote-assistance-request" onSubmit={startSession}>
            <section className="remote-assistance-machine-summary" aria-label="Dados da maquina">
              <div><span>Sistema</span><strong>{asset.os || asset.operatingSystem || "Nao informado"}</strong></div>
              <div><span>Ultimo contato</span><strong>{formatDateTime(getRemoteAssetLastSeenAt(asset))}</strong></div>
              <div><span>Agente</span><strong>{asset.agentVersion || asset.agent?.version || "Ativo"}</strong></div>
              <div><span>Usuario local</span><strong>{asset.localUser || asset.agent?.localUser || "Nao coletado"}</strong></div>
            </section>

            {serviceOrder && (
              <p className="remote-assistance-os-link">Vinculado a OS {serviceOrder.number || serviceOrder.id}</p>
            )}

            <label>
              Motivo do atendimento
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={5}
                maxLength={500}
                required
                placeholder="Descreva o objetivo deste acesso"
              />
            </label>

            <fieldset className="remote-assistance-mode">
              <legend>Permissao solicitada</legend>
              <label>
                <input type="radio" name="remote-mode" value="view" checked={requestedMode === "view"} onChange={() => setRequestedMode("view")} />
                <Eye size={16} /> Somente visualizar
              </label>
              {frontendControlEnabled && config.controlEnabled && canControl && (
                <label>
                  <input type="radio" name="remote-mode" value="control" checked={requestedMode === "control"} onChange={() => setRequestedMode("control")} />
                  <MousePointer2 size={16} /> Solicitar mouse e teclado
                </label>
              )}
            </fieldset>

            <label>
              Confirme sua senha
              <span className="remote-assistance-password">
                <KeyRound size={17} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Senha do seu login"
                />
              </span>
            </label>

            <div className="remote-assistance-security-note">
              <ShieldCheck size={18} />
              <p>O usuario precisa autorizar localmente. A solicitacao, o consentimento e o encerramento ficam registrados.</p>
            </div>
            <p className="remote-assistance-disabled-feature">Modo privacidade e acoes administrativas permanecem indisponiveis nesta fase.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="primary-action remote-assistance-submit" disabled={submitting}>
              {submitting ? <RefreshCw size={17} className="spin" /> : <MonitorUp size={17} />}
              Solicitar atendimento
            </button>
          </form>
        ) : (
          <div className="remote-assistance-viewer">
            <div className="remote-assistance-toolbar">
              <RemoteStatus session={session} />
              {monitors.length > 1 ? (
                <label>
                  <span className="sr-only">Trocar monitor</span>
                  <select
                    value={session.selectedMonitorId || monitors[0]?.id}
                    onChange={(event) => changeMonitor(event.target.value)}
                    disabled={changingMonitor || terminal}
                  >
                    {monitors.map((monitor, index) => (
                      <option key={monitor.id} value={monitor.id}>{formatRemoteMonitor(monitor, index)}</option>
                    ))}
                  </select>
                </label>
              ) : monitors.length === 1 ? (
                <span className="remote-assistance-single-monitor">
                  {formatRemoteMonitor(monitors[0], 0)} (unico monitor)
                </span>
              ) : null}
              {session.status === "active" && (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={togglePause}
                  disabled={submitting || terminal}
                  title={paused ? "Retomar visualizacao" : "Pausar visualizacao"}
                >
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                  {paused ? "Retomar" : "Pausar"}
                </button>
              )}
              {canReconnect && (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={reconnect}
                  disabled={submitting}
                  title="Forcar nova tentativa de conexao"
                >
                  <RefreshCw size={16} /> Reconectar
                </button>
              )}
              {frontendControlEnabled && session.status === "active" && requestedMode === "control" && canControl && (
                <button
                  type="button"
                  className={`secondary-action ${session.remoteControlEnabled ? "active" : ""}`}
                  onClick={toggleControl}
                  disabled={submitting || !session.controlConsentGranted}
                  title={!session.controlConsentGranted ? "O usuario nao autorizou controle" : undefined}
                >
                  <MousePointer2 size={16} />
                  {session.remoteControlEnabled ? "Liberar controle" : "Solicitar controle"}
                </button>
              )}
              {canEnd && !terminal && (
                <button type="button" className="secondary-action danger" onClick={endSession} disabled={submitting}>
                  <Power size={16} /> Encerrar
                </button>
              )}
            </div>

            <div
              ref={imageRef}
              className={`remote-assistance-screen ${controlActive ? "control-active" : ""}`}
              tabIndex={controlActive ? 0 : -1}
              onMouseMove={handleMouseMove}
              onMouseDown={(event) => handleMouseButton(event, "down")}
              onMouseUp={(event) => handleMouseButton(event, "up")}
              onWheel={(event) => {
                if (!controlActive) return;
                event.preventDefault();
                sendInput({ type: "mouse_wheel", delta: event.deltaY });
              }}
              onContextMenu={(event) => {
                if (controlActive) event.preventDefault();
              }}
              onKeyDown={(event) => handleKey(event, "down")}
              onKeyUp={(event) => handleKey(event, "up")}
              aria-label="Tela remota"
            >
              {frame ? <img src={frame} alt={`Tela remota de ${displayName}`} draggable="false" /> : (
                <div className="remote-assistance-waiting">
                  {session.status === "active" ? <RefreshCw size={24} className="spin" /> : <ShieldCheck size={28} />}
                  <strong>{remoteAssistanceStatusLabel(connectionState)}</strong>
                  <span>{session.status === "waiting_consent" ? "Aguardando resposta na maquina." : "A imagem aparecera quando o agente iniciar a transmissao."}</span>
                </div>
              )}
              {changingMonitor && <span className="remote-assistance-loading">Trocando monitor...</span>}
              {paused && !changingMonitor && <span className="remote-assistance-loading">Visualizacao pausada</span>}
              {frameStale && !changingMonitor && !paused && (
                <span className="remote-assistance-loading">Quadro atrasado - tentando atualizar...</span>
              )}
            </div>

            <footer className="remote-assistance-footer">
              <span>Transporte: {remoteAssistanceTransportLabel(session.transport)}</span>
              <span>FPS real: {metrics?.fps ? metrics.fps.toFixed(1) : "--"}</span>
              <span>Latencia HTTP: {latency == null ? "--" : `${latency} ms`}</span>
              <span>Banda: {metrics ? formatBytesPerSecond(metrics.bytesPerSecond) : "--"}</span>
              <span>Qualidade: {metrics?.quality ? `${metrics.quality}%` : "--"}</span>
              <span>Ultimo quadro: {metrics?.lastFrameBytes ? formatFrameSize(metrics.lastFrameBytes) : "--"}</span>
              <span>Controle: {controlActive ? "ativo" : "inativo"}</span>
            </footer>

            <section className="remote-assistance-events" aria-label="Eventos recentes da sessao">
              <h3>Auditoria recente</h3>
              <div>
                {events.slice(0, 5).map((item) => (
                  <p key={item.id}><span>{formatDateTime(item.createdAt)}</span>{item.message}</p>
                ))}
                {!events.length && <p>Nenhum evento recebido ainda.</p>}
              </div>
            </section>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
        )}
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={compact ? "icon-button" : "ghost-action remote-assistance-trigger"}
        disabled={!visible}
        onClick={(event) => {
          if (compact) event.stopPropagation();
          if (!visible) return;
          setOpen(true);
        }}
        title={visible ? (serviceOrder ? "Acessar maquina" : "Atendimento remoto") : unavailableTitle}
        aria-label={serviceOrder ? "Acessar maquina" : "Atendimento remoto"}
      >
        <MonitorUp size={15} />
        {!compact && (serviceOrder ? "Acessar maquina" : "Atendimento remoto")}
      </button>
      {dialog && createPortal(dialog, document.body)}
    </>
  );
}
