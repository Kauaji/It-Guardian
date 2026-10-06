import { RefreshCw } from "lucide-react";
import { assetTypeLabel, assetTypeOptions } from "../assetTypes.js";
import { getMachineSourceLabel } from "../agentPresentation.js";
import MachineAliasEditor from "../MachineAliasEditor.jsx";
import QRCodePrint from "../QRCodePrint.jsx";
import DetailItem from "./DetailItem.jsx";
import MachineOverviewCards from "./MachineOverviewCards.jsx";
import { formatDate } from "./machineDetailsModel.js";

function AgentDetailItems({ agent }) {
  return (
    <>
      <DetailItem label="Intervalo de coleta" value={agent?.intervalSeconds ? `${agent.intervalSeconds} s` : null} />
      <DetailItem label="Coletado em" value={formatDate(agent?.collectedAt)} />
      <DetailItem label="Ambiente informado" value={agent?.environment} />
      <DetailItem label="Grupo informado" value={agent?.group} />
      <DetailItem label="Segmento informado" value={agent?.segment} />
    </>
  );
}

function GeneralDetailGrid({ machine, alias, hardware, manualAsset, agent, isAgentAsset, isManualAsset, sourceCollections }) {
  return (
    <div className="detail-grid">
      <DetailItem label={isManualAsset ? "Nome cadastrado" : "Hostname"} value={machine.name} />
      <DetailItem label="Nome fantasia" value={alias || machine.name} />
      <DetailItem label="Tipo" value={assetTypeLabel(machine.assetType)} />
      <DetailItem label="Origem" value={getMachineSourceLabel(machine)} />
      <DetailItem label="IP" value={machine.ip} />
      <DetailItem label="Arquitetura" value={hardware.architecture} />
      <DetailItem label="Patrimônio" value={hardware.assetTag} />
      <DetailItem label={isManualAsset ? "Localização" : "Usuário logado"} value={isManualAsset ? manualAsset?.location : hardware.loggedUser} />
      <DetailItem label={isManualAsset ? "Última verificação" : "Último inventário"} value={formatDate(isManualAsset ? machine.lastPingAt : hardware.lastInventoryAt)} />
      <DetailItem label={isManualAsset ? "MAC Address" : "Uptime"} value={isManualAsset ? hardware.macAddress : `${machine.uptimeHours} h`} />
      {isAgentAsset && <AgentDetailItems agent={agent} />}
      {sourceCollections.map((collection) => (
        <DetailItem
          key={collection.source}
          label={`Última coleta ${collection.label}`}
          value={formatDate(collection.collectedAt)}
        />
      ))}
      {Boolean(machine.sourceConflicts?.length) && (
        <DetailItem
          label="Correlação entre fontes"
          value="Conflito pendente de revisão"
        />
      )}
    </div>
  );
}

export default function MachineGeneralTab({ model, alias, onAliasSave, onChangeDeviceType, onRefreshPing }) {
  const { machine, isManualAsset, latestChange } = model;
  return (
    <section className="asset-tab-content">
      <MachineOverviewCards
        machine={machine}
        agent={model.agent}
        manualAsset={model.manualAsset}
        isAgentAsset={model.isAgentAsset}
        isManualAsset={isManualAsset}
        diskHealth={model.diskHealth}
      />

      <MachineAliasEditor alias={alias} originalName={machine.name} onSave={onAliasSave} />

      <div className="asset-type-editor">
        <label>
          Tipo do aparelho
          <select value={machine.assetType || "other"} onChange={(event) => onChangeDeviceType(event.target.value)}>
            {assetTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {isManualAsset && (
          <button type="button" onClick={onRefreshPing}>
            <RefreshCw size={15} />
            Atualizar ping
          </button>
        )}
      </div>

      <GeneralDetailGrid
        machine={machine}
        alias={alias}
        hardware={model.hardware}
        manualAsset={model.manualAsset}
        agent={model.agent}
        isAgentAsset={model.isAgentAsset}
        isManualAsset={isManualAsset}
        sourceCollections={model.sourceCollections}
      />

      {latestChange && (
        <div className="latest-change">
          <strong>Última alteração detectada</strong>
          <span>{latestChange.change || latestChange.message} em {formatDate(latestChange.detectedAt || latestChange.createdAt)}</span>
        </div>
      )}

      <QRCodePrint machine={machine} alias={alias} />
    </section>
  );
}
