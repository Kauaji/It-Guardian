import {
  formatBytesPerSecond,
  formatFrameSize,
  remoteAssistanceTransportLabel
} from "../remoteAssistanceModel.js";

// Rodape: transporte e metricas (as metricas nao se aplicam ao RustDesk).
export default function RemoteFooterMetrics({ session, isRustdesk, metrics, latency, controlActive }) {
  return (
    <footer className="remote-assistance-footer">
      <span>Transporte: {remoteAssistanceTransportLabel(session.transport)}</span>
      {!isRustdesk && (
        <>
          <span>FPS real: {metrics?.fps ? metrics.fps.toFixed(1) : "--"}</span>
          <span>Latencia HTTP: {latency == null ? "--" : `${latency} ms`}</span>
          <span>Banda: {metrics ? formatBytesPerSecond(metrics.bytesPerSecond) : "--"}</span>
          <span>Qualidade: {metrics?.quality ? `${metrics.quality}%` : "--"}</span>
          <span>Ultimo quadro: {metrics?.lastFrameBytes ? formatFrameSize(metrics.lastFrameBytes) : "--"}</span>
          <span>Controle: {controlActive ? "ativo" : "inativo"}</span>
        </>
      )}
    </footer>
  );
}
