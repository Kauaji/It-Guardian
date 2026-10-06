import { Clock3, Cpu, HardDrive, MemoryStick, Network } from "lucide-react";
import AssetTypeIcon from "../AssetTypeIcon.jsx";
import { formatBytes, formatDate } from "./machineDetailsModel.js";

function AgentCards({ machine, agent }) {
  return (
    <>
      <article>
        <Clock3 size={18} />
        <span>Última comunicação</span>
        <strong>{formatDate(agent?.lastSeenAt || machine.lastSeenAt)}</strong>
      </article>
      <article>
        <Network size={18} />
        <span>Versão do coletor</span>
        <strong>{agent?.agentVersion || "Não informada"}</strong>
      </article>
      <article>
        <HardDrive size={18} />
        <span>Disco livre</span>
        <strong>{formatBytes(agent?.diskFreeBytes)}</strong>
      </article>
    </>
  );
}

function ManualCards({ machine, manualAsset }) {
  return (
    <>
      <article>
        <Clock3 size={18} />
        <span>Último ping</span>
        <strong>{formatDate(machine.lastPingAt)}</strong>
      </article>
      <article>
        <Network size={18} />
        <span>Identificação</span>
        <strong>{manualAsset?.identificationMode === "fixed_ip" ? "IP fixo" : "MAC/hostname"}</strong>
      </article>
      <article>
        <HardDrive size={18} />
        <span>Patrimônio</span>
        <strong>{manualAsset?.assetTag}</strong>
      </article>
    </>
  );
}

function MonitoredCards({ machine, diskHealth }) {
  return (
    <>
      <article>
        <Cpu size={18} />
        <span>CPU</span>
        <strong>{machine.metrics?.cpu == null ? "Não disponível" : `${machine.metrics.cpu}%`}</strong>
      </article>
      <article>
        <MemoryStick size={18} />
        <span>RAM</span>
        <strong>{machine.metrics?.ram == null ? "Não disponível" : `${machine.metrics.ram}%`}</strong>
      </article>
      <article>
        <HardDrive size={18} />
        <span>Disco</span>
        <strong>{machine.metrics?.disk == null ? "Não disponível" : `${machine.metrics.disk}%`}</strong>
      </article>
      <article>
        <HardDrive size={18} />
        <span>Saúde do disco</span>
        <strong>{diskHealth}</strong>
      </article>
    </>
  );
}

export default function MachineOverviewCards({ machine, agent, manualAsset, isAgentAsset, isManualAsset, diskHealth }) {
  let cards = <MonitoredCards machine={machine} diskHealth={diskHealth} />;
  if (isAgentAsset) cards = <AgentCards machine={machine} agent={agent} />;
  else if (isManualAsset) cards = <ManualCards machine={machine} manualAsset={manualAsset} />;
  return (
    <div className="asset-overview-grid">
      <article>
        <AssetTypeIcon type={machine.assetType} size={18} />
        <span>Status</span>
        <strong>{machine.statusLabel}</strong>
      </article>
      {cards}
    </div>
  );
}
