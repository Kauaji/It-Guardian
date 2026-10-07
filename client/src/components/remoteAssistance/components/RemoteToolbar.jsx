import { Lock, Maximize2, MessageCircle, Minimize2, MousePointer2, Pause, Play, Power, RefreshCw, Unlock } from "lucide-react";
import RemoteMonitorPicker from "./RemoteMonitorPicker.jsx";
import RemoteStatus from "./RemoteStatus.jsx";

function ControlButton({ session, submitting, onToggle }) {
  return (
    <button
      type="button"
      className={`secondary-action ${session.remoteControlEnabled ? "active" : ""}`}
      onClick={onToggle}
      disabled={submitting || !session.controlConsentGranted}
      title={!session.controlConsentGranted ? "O usuário não autorizou controle" : undefined}
    >
      <MousePointer2 size={16} />
      {session.remoteControlEnabled ? "Liberar controle" : "Solicitar controle"}
    </button>
  );
}

function KeyboardLockButton({ locked, submitting, onToggle }) {
  return (
    <button
      type="button"
      className={`secondary-action ${locked ? "active" : ""}`}
      onClick={onToggle}
      disabled={submitting}
      title={locked ? "Destravar teclado e mouse locais" : "Travar teclado e mouse locais"}
    >
      {locked ? <Unlock size={16} /> : <Lock size={16} />}
      {locked ? "Destravar teclado" : "Travar teclado"}
    </button>
  );
}

// Botoes de tela/controle: nao existem no transporte RustDesk.
function NativeViewerActions({ view, control, actions }) {
  const { session, submitting, terminal, paused, canReconnect, requestedMode, canControl, maximized } = view;
  return (
    <>
      {session.status === "active" && (
        <button
          type="button"
          className="secondary-action"
          onClick={actions.onTogglePause}
          disabled={submitting || terminal}
          title={paused ? "Retomar visualização" : "Pausar visualização"}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
          {paused ? "Retomar" : "Pausar"}
        </button>
      )}
      {canReconnect && (
        <button
          type="button"
          className="secondary-action"
          onClick={actions.onReconnect}
          disabled={submitting}
          title="Forçar nova tentativa de conexão"
        >
          <RefreshCw size={16} /> Reconectar
        </button>
      )}
      {view.frontendControlEnabled && session.status === "active" && requestedMode === "control" && canControl && (
        <ControlButton session={session} submitting={submitting} onToggle={actions.onToggleControl} />
      )}
      {control.controlActive && (
        <KeyboardLockButton locked={control.keyboardLocked} submitting={submitting} onToggle={actions.onToggleKeyboardLock} />
      )}
      <button
        type="button"
        className="secondary-action"
        onClick={actions.onToggleMaximize}
        title={maximized ? "Restaurar tamanho da janela" : "Maximizar tela"}
      >
        {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        {maximized ? "Restaurar" : "Maximizar"}
      </button>
    </>
  );
}

// Barra de controles da sessao: estado, monitor, pausa, controle, chat e encerrar.
export default function RemoteToolbar({ view, control, chatOpen, actions }) {
  const { session, isRustdesk, monitors, changingMonitor, terminal, submitting, canEnd } = view;
  return (
    <div className="remote-assistance-toolbar">
      <RemoteStatus session={session} />
      {isRustdesk ? null : (
        <RemoteMonitorPicker
          session={session}
          monitors={monitors}
          changingMonitor={changingMonitor}
          terminal={terminal}
          onChange={actions.onChangeMonitor}
        />
      )}
      {!isRustdesk && <NativeViewerActions view={view} control={control} actions={actions} />}
      <button
        type="button"
        className="secondary-action"
        onClick={actions.onToggleChat}
        title={chatOpen ? "Fechar o chat com o usuário local" : "Abrir o chat com o usuário local"}
      >
        <MessageCircle size={16} />
        {chatOpen ? "Fechar chat" : "Abrir chat"}
      </button>
      {canEnd && !terminal && (
        <button type="button" className="secondary-action danger" onClick={actions.onEnd} disabled={submitting}>
          <Power size={16} /> Encerrar
        </button>
      )}
    </div>
  );
}
