import { useRef, useState } from "react";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import { getRemoteAssetDisplayName } from "../remoteAssistanceModel.js";
import { getMonitorState, getSessionFlags } from "../utils/viewState.js";
import { useBodyScrollLock } from "./useBodyScrollLock.js";
import { useRemoteAssistanceSession } from "./useRemoteAssistanceSession.js";
import { useRemoteChat } from "./useRemoteChat.js";
import { useRemoteControl } from "./useRemoteControl.js";
import { useRemoteReauth } from "./useRemoteReauth.js";
import { useRemoteViewer } from "./useRemoteViewer.js";
import { useRemoteWebrtc } from "./useRemoteWebrtc.js";
import { useRustdeskCredentials } from "./useRustdeskCredentials.js";

const defaultViewerPollMs = 1000;

// Une os hooks por responsabilidade do dialogo de assistencia remota e expoe
// ao componente o que a interface precisa renderizar.
export function useRemoteAssistanceDialog({ asset, alias, serviceOrder, token, notify, availability }) {
  const { config, frontendControlEnabled, canControl, canEnd } = availability;
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const screenRef = useRef(null);
  const viewerPollMs = config?.viewerPollMs || defaultViewerPollMs;

  const form = useRemoteReauth({ token, asset, serviceOrder });
  const remote = useRemoteAssistanceSession({ open, token, notify });
  const { session, viewerToken, setSession, setError } = remote;
  const chat = useRemoteChat({ token, session, viewerToken, setError });
  const viewer = useRemoteViewer({
    open,
    token,
    session,
    viewerToken,
    viewerPollMs,
    setSession,
    setMetrics: remote.setMetrics,
    setError,
    onChatMessages: chat.replaceMessages,
    refreshSession: remote.refreshSession
  });
  const webrtc = useRemoteWebrtc({
    open,
    token,
    session,
    viewerToken,
    iceServers: config?.iceServers,
    onError: setError
  });
  const rustdesk = useRustdeskCredentials({ token, session, viewerToken, notify });
  const control = useRemoteControl({
    frontendControlEnabled,
    session,
    requestedMode: form.requestedMode,
    token,
    viewerToken,
    setSession,
    setError,
    perform: remote.perform,
    screenRef
  });
  useBodyScrollLock(open);

  const flags = getSessionFlags({ session, metrics: remote.metrics, viewerPollMs, error: remote.error });

  function startSession(event) {
    event.preventDefault();
    return remote.start({
      reauthenticate: form.reauthenticate,
      assetId: asset.id,
      serviceOrderId: serviceOrder?.id,
      reason: form.reason,
      requestedMode: form.requestedMode,
      onFinished: form.clearPassword
    });
  }

  function endSession() {
    return remote.end({
      onEnded: () => {
        viewer.clearFrame();
        rustdesk.clear();
      }
    });
  }

  async function closeDialog() {
    if (session?.id && !flags.terminal) {
      const confirmed = window.confirm("Encerrar o atendimento remoto antes de fechar?");
      if (!confirmed) return;
      await endSession();
    }
    setOpen(false);
    remote.reset();
    viewer.clearFrame();
    form.reset();
    chat.reset();
    setMaximized(false);
    control.reset();
    rustdesk.reset();
  }

  const dialogRef = useModalLifecycle(open, closeDialog);

  const view = {
    ...flags,
    ...getMonitorState(session),
    session,
    displayName: getRemoteAssetDisplayName(asset, alias),
    submitting: remote.submitting,
    changingMonitor: viewer.changingMonitor,
    canEnd,
    canControl,
    requestedMode: form.requestedMode,
    frontendControlEnabled,
    maximized
  };
  const actions = {
    onTogglePause: remote.togglePause,
    onReconnect: viewer.reconnect,
    onToggleControl: control.toggleControl,
    onToggleKeyboardLock: control.toggleKeyboardLock,
    onToggleMaximize: () => setMaximized((value) => !value),
    onToggleChat: chat.toggle,
    onChangeMonitor: viewer.changeMonitor,
    onEnd: endSession
  };

  return {
    open,
    openDialog: () => setOpen(true),
    closeDialog,
    dialogRef,
    startSession,
    form,
    remote,
    chat,
    viewer,
    webrtc,
    rustdesk,
    control,
    screenRef,
    view,
    actions
  };
}
