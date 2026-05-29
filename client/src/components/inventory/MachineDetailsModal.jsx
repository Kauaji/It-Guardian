import { Archive, Clock3, Cpu, HardDrive, KeyRound, MemoryStick, Network, RefreshCw, Trash2, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  { id: "alerts", label: "Alertas" },
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
      <strong>{value || "Nao disponivel"}</strong>
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

function buildMetricAlert({ metric, label, value, warningLimit = 70, criticalLimit = 85 }) {
  if (value == null || value < warningLimit) return null;

  const isCritical = value >= criticalLimit;
  return {
    id: `metric-${metric}`,
    description: `${label} acima do limite: ${value}%`,
    detectedAt: new Date().toISOString(),
    type: "Metrica",
    severity: isCritical ? "Critico" : "Atencao",
    metric: label,
    value: `${value}%`,
    limit: `${isCritical ? criticalLimit : warningLimit}%`,
    status: "Ativo"
  };
}

function buildActiveAlerts(machine) {
  if (!machine) return [];

  const alerts = [];
  const metrics = machine.metrics || {};

  [buildMetricAlert({ metric: "cpu", label: "CPU", value: metrics.cpu }),
    buildMetricAlert({ metric: "ram", label: "RAM", value: metrics.ram }),
    buildMetricAlert({ metric: "disk", label: "Disco", value: metrics.disk })]
    .filter(Boolean)
    .forEach((alert) => alerts.push(alert));

  if (machine.status === "offline") {
    alerts.push({
      id: "ping-offline",
      description: "Maquina nao responde ping",
      detectedAt: machine.lastPingAt || new Date().toISOString(),
      type: "Conectividade",
      severity: "Critico",
      metric: "Ping",
      value: "Sem resposta",
      limit: "Resposta esperada",
      status: "Ativo"
    });
  }

  for (const alert of machine.alerts || []) {
    if (alert.status !== "active") continue;
    alerts.push({
      id: alert.id,
      description: alert.description || alert.title || "Alerta ativo no monitoramento",
      detectedAt: alert.startedAt,
      type: alert.title || "Alerta ativo",
      severity: alert.severity === "critical" ? "Critico" : "Atencao",
      metric: alert.metric || "Monitoramento",
      value: alert.value || "Ativo",
      limit: alert.limit || "Regra Zabbix",
      status: "Ativo"
    });
  }

  if (machine.status === "problem" && !alerts.length) {
    alerts.push({
      id: "monitoring-problem",
      description: "Alerta ativo no monitoramento",
      detectedAt: new Date().toISOString(),
      type: "Monitoramento",
      severity: "Atencao",
      metric: "Status",
      value: "Problema",
      limit: "Operacao normal",
      status: "Ativo"
    });
  }

  return alerts;
}

function buildResolvedAlerts(machine, hardware) {
  return [...(machine?.assetHistory || []), ...(hardware?.changeHistory || [])]
    .filter((item) => /resolvid|normal|voltou|restaur/i.test(`${item.change || ""} ${item.message || ""}`))
    .map((item) => ({
      id: item.id || `${item.detectedAt || item.createdAt}-${item.change || item.message}`,
      description: item.change || item.message || "Erro resolvido",
      detectedAt: item.detectedAt || item.createdAt,
      type: "Historico",
      severity: "Informativo",
      metric: item.field || "Ativo",
      value: item.newValue || "Normal",
      limit: item.oldValue || "Anterior",
      status: "Resolvido"
    }));
}

function normalizeSoftware(software) {
  if (typeof software === "string") {
    return {
      name: software,
      version: null,
      manufacturer: null,
      installedAt: null
    };
  }

  return {
    name: software?.name || software?.title || "Software sem nome",
    version: software?.version || null,
    manufacturer: software?.manufacturer || software?.publisher || null,
    installedAt: software?.installedAt || software?.installDate || null
  };
}

function getDiskHealth(hardware = {}) {
  const directHealth =
    hardware.diskHealth ||
    hardware.storageHealth ||
    hardware.smartHealth ||
    hardware.smartStatus;

  if (directHealth) {
    if (typeof directHealth === "object") {
      return directHealth.status || directHealth.value || directHealth.health || "Nao disponivel";
    }
    return directHealth;
  }

  const diskWithHealth = (hardware.disks || []).find((disk) =>
    disk.health || disk.smartStatus || disk.healthPercent !== undefined || disk.status
  );

  if (!diskWithHealth) return "Nao disponivel";
  if (diskWithHealth.healthPercent !== undefined) return `${diskWithHealth.healthPercent}%`;
  return diskWithHealth.health || diskWithHealth.smartStatus || diskWithHealth.status || "Nao disponivel";
}

function isMaintenanceSegmentName(name = "") {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase() === "manutencao";
}

function ErrorAlertList({ alerts, resolvedAlerts }) {
  return (
    <section className="asset-tab-content">
      <div className="error-alert-section">
        <div>
          <h3>Alertas ativos</h3>
          <span>{alerts.length} em andamento</span>
        </div>
        <div className="error-alert-list">
          {alerts.map((alert) => (
            <article key={alert.id} className={`error-alert-card ${alert.severity === "Critico" ? "critical" : "warning"}`}>
              <header>
                <strong>{alert.description}</strong>
                <span>{alert.status}</span>
              </header>
              <dl>
                <div><dt>Detectado</dt><dd>{formatDate(alert.detectedAt)}</dd></div>
                <div><dt>Tipo</dt><dd>{alert.type}</dd></div>
                <div><dt>Severidade</dt><dd>{alert.severity}</dd></div>
                <div><dt>Metrica</dt><dd>{alert.metric}</dd></div>
                <div><dt>Valor atual</dt><dd>{alert.value}</dd></div>
                <div><dt>Limite</dt><dd>{alert.limit}</dd></div>
              </dl>
            </article>
          ))}
          {!alerts.length && <p className="empty">Nenhum alerta ativo neste momento.</p>}
        </div>
      </div>

      <div className="error-alert-section resolved">
        <div>
          <h3>Resolvidos no historico</h3>
          <span>{resolvedAlerts.length} registros</span>
        </div>
        <div className="error-alert-list compact">
          {resolvedAlerts.map((alert) => (
            <article key={alert.id} className="error-alert-card resolved">
              <header>
                <strong>{alert.description}</strong>
                <span>{alert.status}</span>
              </header>
              <p>{alert.metric}: {alert.limit} para {alert.value} em {formatDate(alert.detectedAt)}</p>
            </article>
          ))}
          {!resolvedAlerts.length && <p className="empty">Nenhum erro resolvido registrado ainda.</p>}
        </div>
      </div>
    </section>
  );
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
  onPutMaintenance,
  onToggleBackup,
  onRemoveMachine,
  onRemovePeripheral,
  onClose
}) {
  const [activeTab, setActiveTab] = useState("general");
  const hardware = machine?.hardware || {};
  const manualAsset = machine?.manualAsset;
  const isManualAsset = machine?.source === "manual";
  const inMaintenance = Boolean(machine?.maintenance) || isMaintenanceSegmentName(machine?.segmentName);
  const backupInUse = machine?.backupStatus === "in_use";
  const latestChange = useMemo(
    () => [...(machine?.assetHistory || []), ...(hardware.changeHistory || [])][0],
    [hardware.changeHistory, machine?.assetHistory]
  );
  const activeAlerts = useMemo(() => buildActiveAlerts(machine), [machine]);
  const resolvedAlerts = useMemo(() => buildResolvedAlerts(machine, hardware), [hardware, machine]);
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.id !== "alerts" || activeAlerts.length > 0 || resolvedAlerts.length > 0),
    [activeAlerts.length, resolvedAlerts.length]
  );
  const softwareRows = useMemo(
    () => (hardware.software || []).map(normalizeSoftware),
    [hardware.software]
  );
  const diskHealth = useMemo(() => getDiskHealth(hardware), [hardware]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("general");
    }
  }, [activeTab, visibleTabs]);

  if (!machine) return null;

  return (
    <div className="modal-backdrop asset-modal-backdrop" role="presentation">
      <section className="asset-modal" role="dialog" aria-modal="true" aria-label="Detalhes do ativo">
        <header className="asset-modal-header">
          <div>
            <span className="asset-eyebrow">{isManualAsset ? "Ativo de rede manual" : "Inventário OCS"}</span>
            <h2>{alias || machine.name}</h2>
            <p>{machine.name} - {machine.ip}</p>
          </div>
          <div className="asset-modal-header-actions">
            <button
              type="button"
              className={`ghost-action maintenance-action ${inMaintenance ? "active" : ""}`}
              onClick={onPutMaintenance}
              title={inMaintenance ? "Retirar da manutencao" : "Colocar em manutencao"}
            >
              <Wrench size={15} />
              {inMaintenance ? "Retirar da manutencao" : "Colocar em manutencao"}
            </button>
            <button
              type="button"
              className={`ghost-action backup-action ${machine?.isBackup ? "active" : ""}`}
              onClick={() => onToggleBackup?.(!machine?.isBackup)}
              disabled={backupInUse}
              title={backupInUse ? "Backup em uso por uma OS" : machine?.isBackup ? "Remover da area de Backup" : "Marcar como Backup"}
            >
              <Archive size={15} />
              {backupInUse ? "Backup em uso" : machine?.isBackup ? "Remover Backup" : "Marcar Backup"}
            </button>
            <button type="button" className="ghost-action danger-action" onClick={onRemoveMachine} title="Remover maquina do inventario">
              <Trash2 size={15} />
              Remover
            </button>
            <button type="button" className="icon-button" onClick={onClose} title="Fechar">
              <X size={18} />
            </button>
          </div>
        </header>

        <MachineTabs activeTab={activeTab} tabs={visibleTabs} onChange={setActiveTab} />

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
                    <article>
                      <HardDrive size={18} />
                      <span>Saude do disco</span>
                      <strong>{diskHealth}</strong>
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
                <DetailItem label="Arquitetura" value={hardware.architecture} />
                <DetailItem label="Patrimonio" value={hardware.assetTag} />
                <DetailItem label={isManualAsset ? "Localizacao" : "Usuario logado"} value={isManualAsset ? manualAsset?.location : hardware.loggedUser} />
                <DetailItem label={isManualAsset ? "Ultima verificacao" : "Ultimo inventario"} value={formatDate(isManualAsset ? machine.lastPingAt : hardware.lastInventoryAt)} />
                <DetailItem label={isManualAsset ? "MAC Address" : "Uptime"} value={isManualAsset ? hardware.macAddress : `${machine.uptimeHours} h`} />
              </div>

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
                <DetailItem label="Hostname" value={machine.name} />
                <DetailItem label="Sistema operacional" value={hardware.os} />
                <DetailItem label="Versao do SO" value={hardware.osVersion || hardware.os} />
                <DetailItem label="Arquitetura" value={hardware.architecture} />
                <DetailItem label="Fabricante" value={hardware.manufacturer} />
                <DetailItem label="Modelo" value={hardware.model} />
                <DetailItem label="Serial number" value={hardware.serialNumber} />
                <DetailItem label="Processador" value={hardware.cpuModel} />
                <DetailItem label="Nucleos" value={hardware.cpuCores} />
                <DetailItem label="Memoria RAM" value={hardware.ramGb ? `${hardware.ramGb} GB` : null} />
                <DetailItem label="Saude da memoria" value={hardware.memoryHealth?.status || hardware.memoryHealth} />
                <DetailItem label="Licenca Windows" value={hardware.licenses?.windowsKey || hardware.windowsKey} />
                <DetailItem label="Office" value={hardware.licenses?.officeVersion || hardware.officeVersion} />
                <DetailItem label="Licenca Office" value={hardware.licenses?.officeKey || hardware.officeKey} />
              </div>
              <div className="disk-detail-list">
                {(hardware.disks || []).map((disk) => (
                  <article key={disk.label}>
                    <HardDrive size={16} />
                    <strong>{disk.label}</strong>
                    <span>{disk.sizeGb} GB - {disk.type}</span>
                    <small>SMART: {disk.smartStatus || disk.health || "Nao disponivel"}</small>
                    <small>Temperatura: {disk.temperatureC ? `${disk.temperatureC} C` : "Nao disponivel"}</small>
                    <small>Horas ligadas: {disk.powerOnHours || "Nao disponivel"}</small>
                    <small>Setores realocados: {disk.reallocatedSectors ?? "Nao disponivel"}</small>
                    <small>TB escritos: {disk.tbWritten || "Nao disponivel"}</small>
                  </article>
                ))}
                {isManualAsset && <p className="empty">Ativo de rede sem coleta OCS de discos ou CPU.</p>}
              </div>
              <div className="license-note">
                <KeyRound size={16} />
                <span>Licencas e saude fisica sao exibidas apenas quando OCS/Zabbix disponibilizam esses dados.</span>
              </div>
            </section>
          )}

          {activeTab === "alerts" && (
            <ErrorAlertList alerts={activeAlerts} resolvedAlerts={resolvedAlerts} />
          )}

          {activeTab === "software" && (
            <section className="asset-tab-content">
              <div className="software-table-list">
                {softwareRows.map((software) => (
                  <article key={`${software.name}-${software.version || "sem-versao"}`}>
                    <strong>{software.name}</strong>
                    <span>Versao: {software.version || "Nao disponivel"}</span>
                    <span>Fabricante: {software.manufacturer || "Nao disponivel"}</span>
                    <span>Instalacao: {software.installedAt ? formatDate(software.installedAt) : "Nao disponivel"}</span>
                  </article>
                ))}
              </div>
              {!softwareRows.length && !isManualAsset && <p className="empty">Nenhum software retornado pelo OCS.</p>}
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
                <PeripheralList
                  peripherals={hardware.peripherals || []}
                  segmentColor={segmentColor}
                  canManage
                  onRemove={onRemovePeripheral}
                />
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
              {resolvedAlerts.length > 0 && (
                <div className="error-alert-section resolved">
                  <div>
                    <h3>Erros resolvidos</h3>
                    <span>{resolvedAlerts.length} registros</span>
                  </div>
                  <div className="error-alert-list compact">
                    {resolvedAlerts.map((alert) => (
                      <article key={alert.id} className="error-alert-card resolved">
                        <header>
                          <strong>{alert.description}</strong>
                          <span>{alert.status}</span>
                        </header>
                        <p>{alert.metric}: {alert.limit} para {alert.value} em {formatDate(alert.detectedAt)}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              <HardwareHistory changes={machine.assetHistory || []} />
              <HardwareHistory changes={hardware.changeHistory || []} />
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
