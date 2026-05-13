import { Clock3, Cpu, HardDrive, MemoryStick, Network, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import AssetTypeIcon from "./AssetTypeIcon.jsx";
import { assetTypeLabel, assetTypeOptions } from "./assetTypes.js";
import HardwareHistory from "./HardwareHistory.jsx";
import MachineAliasEditor from "./MachineAliasEditor.jsx";
import MachineTabs from "./MachineTabs.jsx";
import ObservationTimeline from "./ObservationTimeline.jsx";
import PeripheralList from "./PeripheralList.jsx";
import QRCodePrint from "./QRCodePrint.jsx";

const tabs = [
  { id: "general", label: "Geral" },
  { id: "hardware", label: "Hardware" },
  { id: "software", label: "Softwares" },
  { id: "network", label: "Rede" },
  { id: "peripherals", label: "Perifericos" },
  { id: "notes", label: "Observacoes" },
  { id: "history", label: "Historico" }
];

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || "Nao informado"}</strong>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function MachineDetailsModal({
  machine,
  alias,
  observations,
  segmentColor,
  userName,
  onAliasSave,
  onAddObservation,
  onChangeDeviceType,
  onRefreshPing,
  onClose
}) {
  const [activeTab, setActiveTab] = useState("general");
  const hardware = machine?.hardware || {};
  const manualAsset = machine?.manualAsset;
  const isManualAsset = machine?.source === "manual";
  const latestChange = useMemo(
    () => [...(machine?.assetHistory || []), ...(hardware.changeHistory || [])][0],
    [hardware.changeHistory, machine?.assetHistory]
  );

  if (!machine) return null;

  return (
    <div className="modal-backdrop asset-modal-backdrop" role="presentation">
      <section className="asset-modal" role="dialog" aria-modal="true" aria-label="Detalhes do ativo">
        <header className="asset-modal-header">
          <div>
            <span className="asset-eyebrow">{isManualAsset ? "Ativo de rede manual" : "Inventario OCS"}</span>
            <h2>{alias || machine.name}</h2>
            <p>{machine.name} - {machine.ip}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        <MachineTabs activeTab={activeTab} tabs={tabs} onChange={setActiveTab} />

        <div className="asset-modal-body">
          {activeTab === "general" && (
            <section className="asset-tab-content">
              <div className="asset-overview-grid">
                <article>
                  <AssetTypeIcon type={machine.assetType} size={18} />
                  <span>Status</span>
                  <strong>{machine.statusLabel}</strong>
                </article>
                {isManualAsset ? (
                  <>
                    <article>
                      <Clock3 size={18} />
                      <span>Ultimo ping</span>
                      <strong>{formatDate(machine.lastPingAt)}</strong>
                    </article>
                    <article>
                      <Network size={18} />
                      <span>Identificacao</span>
                      <strong>{manualAsset?.identificationMode === "fixed_ip" ? "IP fixo" : "MAC/hostname"}</strong>
                    </article>
                    <article>
                      <HardDrive size={18} />
                      <span>Patrimonio</span>
                      <strong>{manualAsset?.assetTag}</strong>
                    </article>
                  </>
                ) : (
                  <>
                    <article>
                      <Cpu size={18} />
                      <span>CPU</span>
                      <strong>{machine.metrics.cpu}%</strong>
                    </article>
                    <article>
                      <MemoryStick size={18} />
                      <span>RAM</span>
                      <strong>{machine.metrics.ram}%</strong>
                    </article>
                    <article>
                      <HardDrive size={18} />
                      <span>Disco</span>
                      <strong>{machine.metrics.disk}%</strong>
                    </article>
                  </>
                )}
              </div>

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

              <div className="detail-grid">
                <DetailItem label={isManualAsset ? "Nome cadastrado" : "Hostname OCS"} value={machine.name} />
                <DetailItem label="Nome fantasia" value={alias || machine.name} />
                <DetailItem label="Tipo" value={assetTypeLabel(machine.assetType)} />
                <DetailItem label="IP" value={machine.ip} />
                <DetailItem label={isManualAsset ? "Hostname" : "Sistema operacional"} value={isManualAsset ? manualAsset?.hostname : hardware.os} />
                <DetailItem label="Patrimonio" value={hardware.assetTag} />
                <DetailItem label={isManualAsset ? "Localizacao" : "Usuario logado"} value={isManualAsset ? manualAsset?.location : hardware.loggedUser} />
                <DetailItem label={isManualAsset ? "Ultima verificacao" : "Ultimo inventario"} value={formatDate(isManualAsset ? machine.lastPingAt : hardware.lastInventoryAt)} />
                <DetailItem label={isManualAsset ? "MAC Address" : "Uptime"} value={isManualAsset ? hardware.macAddress : `${machine.uptimeHours} h`} />
              </div>

              {isManualAsset && machine.status === "offline" && (
                <div className="latest-change warning-note">
                  <strong>Ativo offline</strong>
                  <span>{machine.pingMessage}</span>
                </div>
              )}

              {latestChange && (
                <div className="latest-change">
                  <strong>Ultima alteracao detectada</strong>
                  <span>{latestChange.change || latestChange.message} em {formatDate(latestChange.detectedAt || latestChange.createdAt)}</span>
                </div>
              )}

              <QRCodePrint machine={machine} alias={alias} />
            </section>
          )}

          {activeTab === "hardware" && (
            <section className="asset-tab-content">
              <div className="detail-grid">
                <DetailItem label="Fabricante" value={hardware.manufacturer} />
                <DetailItem label="Modelo" value={hardware.model} />
                <DetailItem label="Serial number" value={hardware.serialNumber} />
                <DetailItem label="Processador" value={hardware.cpuModel} />
                <DetailItem label="Nucleos" value={hardware.cpuCores} />
                <DetailItem label="Memoria RAM" value={hardware.ramGb ? `${hardware.ramGb} GB` : null} />
              </div>
              <div className="disk-detail-list">
                {(hardware.disks || []).map((disk) => (
                  <article key={disk.label}>
                    <HardDrive size={16} />
                    <strong>{disk.label}</strong>
                    <span>{disk.sizeGb} GB - {disk.type}</span>
                  </article>
                ))}
                {isManualAsset && <p className="empty">Ativo de rede sem coleta OCS de discos ou CPU.</p>}
              </div>
            </section>
          )}

          {activeTab === "software" && (
            <section className="asset-tab-content software-tab-list">
              {(hardware.software || []).map((software) => <span key={software}>{software}</span>)}
              {isManualAsset && <p className="empty">Softwares nao se aplicam a este ativo manual.</p>}
            </section>
          )}

          {activeTab === "network" && (
            <section className="asset-tab-content">
              <div className="detail-grid">
                <DetailItem label="IP" value={machine.ip} />
                <DetailItem label="MAC Address" value={hardware.macAddress} />
                <DetailItem label="Hostname" value={manualAsset?.hostname} />
                <DetailItem label="Modo de identificacao" value={manualAsset?.identificationMode} />
                {!isManualAsset && (
                  <>
                    <DetailItem label="Entrada" value={`${machine.metrics.networkInMbps} Mbps`} />
                    <DetailItem label="Saida" value={`${machine.metrics.networkOutMbps} Mbps`} />
                  </>
                )}
              </div>
              <div className="network-card">
                <Network size={18} />
                <span>{isManualAsset ? "Status preparado para ping real; o MVP usa simulacao separada no backend." : "Telemetria em tempo real via Zabbix"}</span>
              </div>
            </section>
          )}

          {activeTab === "peripherals" && (
            <section className="asset-tab-content">
              {isManualAsset ? (
                <div className="network-card">
                  <AssetTypeIcon type={machine.assetType} size={18} />
                  <span>Ativos de rede nao sao perifericos USB. Eles possuem IP proprio e aparecem como itens independentes.</span>
                </div>
              ) : (
                <PeripheralList peripherals={hardware.peripherals || []} segmentColor={segmentColor} />
              )}
            </section>
          )}

          {activeTab === "notes" && (
            <ObservationTimeline
              observations={observations}
              userName={userName}
              onAdd={onAddObservation}
            />
          )}

          {activeTab === "history" && (
            <section className="asset-tab-content">
              <HardwareHistory changes={machine.assetHistory || []} />
              <HardwareHistory changes={hardware.changeHistory || []} />
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
