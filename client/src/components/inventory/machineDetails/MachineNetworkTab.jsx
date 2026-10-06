import { Network } from "lucide-react";
import DetailItem from "./DetailItem.jsx";

function networkNote(isAgentAsset, isManualAsset) {
  if (isAgentAsset) return "IP e MAC coletados localmente pelo Agente IT Guardian. Tráfego de rede não é coletado.";
  if (isManualAsset) return "Status preparado para ping real; o MVP usa simulação separada no backend.";
  return "Telemetria fornecida pela fonte de monitoramento configurada";
}

export default function MachineNetworkTab({ model }) {
  const { machine, hardware, agent, manualAsset, isAgentAsset, isManualAsset } = model;
  return (
    <section className="asset-tab-content">
      <div className="detail-grid">
        <DetailItem label="IP" value={machine.ip} />
        <DetailItem label="MAC Address" value={agent?.macAddress || hardware.macAddress} />
        <DetailItem label="Hostname" value={agent?.hostname || manualAsset?.hostname || machine.name} />
        <DetailItem
          label="Adaptadores ativos"
          value={hardware.networkAdapters?.map((adapter) => adapter.name).filter(Boolean).join(", ")}
        />
        {isManualAsset && <DetailItem label="Modo de identificação" value={manualAsset?.identificationMode} />}
        {!isManualAsset && !isAgentAsset && machine.metrics && (
          <>
            <DetailItem label="Entrada" value={`${machine.metrics.networkInMbps} Mbps`} />
            <DetailItem label="Saída" value={`${machine.metrics.networkOutMbps} Mbps`} />
          </>
        )}
      </div>
      <div className="network-card">
        <Network size={18} />
        <span>{networkNote(isAgentAsset, isManualAsset)}</span>
      </div>
    </section>
  );
}
