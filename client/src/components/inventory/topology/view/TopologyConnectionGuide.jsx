import { buildConnectionGuideText } from "./topologyViewConstants.js";

// Guia exibido enquanto o usuario escolhe origem e destino de uma conexao.
export default function TopologyConnectionGuide({ active, creatingLink, sourceNodeId, labels, onCancel }) {
  if (!active) return null;
  return (
    <div className="network-topology-connection-guide" role="status">
      <span>{buildConnectionGuideText({ creatingLink, sourceNodeId, labels })}</span>
      {!creatingLink ? <button type="button" className="network-topology-toolbar-button" onClick={onCancel}>Cancelar conexão</button> : null}
    </div>
  );
}
