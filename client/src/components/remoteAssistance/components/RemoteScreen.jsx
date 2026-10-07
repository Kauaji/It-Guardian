import { RefreshCw, ShieldCheck } from "lucide-react";
import { remoteAssistanceStatusLabel } from "../remoteAssistanceModel.js";
import RemoteWaitingState from "./RemoteWaitingState.jsx";

function ScreenContent({ view, screen }) {
  const { session, isWebrtc, connectionState, displayName } = view;
  const { frame, videoRef, trackActive } = screen;
  if (isWebrtc) {
    return (
      <>
        <video
          ref={videoRef}
          className="remote-assistance-video"
          autoPlay
          playsInline
          muted
          style={{ display: trackActive ? "block" : "none" }}
        />
        {!trackActive && (
          <RemoteWaitingState icon={<RefreshCw size={24} className="spin" />} title={remoteAssistanceStatusLabel(connectionState)}>
            Negociando conexão WebRTC com o agente...
          </RemoteWaitingState>
        )}
      </>
    );
  }
  if (frame) return <img src={frame} alt={`Tela remota de ${displayName}`} draggable="false" />;
  return (
    <RemoteWaitingState
      icon={session.status === "active" ? <RefreshCw size={24} className="spin" /> : <ShieldCheck size={28} />}
      title={remoteAssistanceStatusLabel(connectionState)}
    >
      {session.status === "waiting_consent"
        ? "Aguardando resposta na máquina."
        : "A imagem aparecerá quando o agente iniciar a transmissão."}
    </RemoteWaitingState>
  );
}

// Visor da tela remota (snapshot ou WebRTC) com a captura de mouse/teclado.
export default function RemoteScreen({ view, screen, control, screenRef }) {
  const { isWebrtc, changingMonitor, paused, frameStale } = view;
  return (
    <div
      ref={screenRef}
      className={`remote-assistance-screen ${control.controlActive ? "control-active" : ""}`}
      style={{ aspectRatio: view.screenAspectRatio }}
      tabIndex={control.controlActive ? 0 : -1}
      {...control.screenHandlers}
      aria-label="Tela remota"
    >
      <ScreenContent view={view} screen={screen} />
      {changingMonitor && <span className="remote-assistance-loading">Trocando monitor...</span>}
      {paused && !changingMonitor && <span className="remote-assistance-loading">Visualização pausada</span>}
      {!isWebrtc && frameStale && !changingMonitor && !paused && (
        <span className="remote-assistance-loading">Quadro atrasado - tentando atualizar...</span>
      )}
    </div>
  );
}
