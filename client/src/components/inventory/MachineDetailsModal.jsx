import {
  Archive,
  Battery,
  CircuitBoard,
  Clock3,
  Cpu,
  HardDrive,
  KeyRound,
  Laptop,
  MemoryStick,
  Monitor,
  Network,
  RefreshCw,
  Trash2,
  Wrench,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AssetTypeIcon from "./AssetTypeIcon.jsx";
import { assetTypeLabel, assetTypeOptions } from "./assetTypes.js";
import HardwareHistory from "./HardwareHistory.jsx";
import MachineAliasEditor from "./MachineAliasEditor.jsx";
import MachineTabs from "./MachineTabs.jsx";
import ObservationTimeline from "./ObservationTimeline.jsx";
import PeripheralList from "./PeripheralList.jsx";
import QRCodePrint from "./QRCodePrint.jsx";
import AutomationIndicatorDots from "../AutomationIndicatorDots.jsx";
import {
  getMachineSourceCollections,
  getMachineSourceLabel,
  isAgentMachine
} from "./agentPresentation.js";
import { formatHardwareValue } from "./hardwarePresentation.js";

const tabs = [
  { id: "general", label: "Geral" },
  { id: "alerts", label: "Alertas" },
  { id: "hardware", label: "Hardware" },
  { id: "software", label: "Softwares" },
  { id: "network", label: "Rede" },
  { id: "peripherals", label: "Periféricos" },
  { id: "notes", label: "Observações" },
  { id: "history", label: "Histórico" }
];

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{formatHardwareValue(value)}</strong>
    </div>
  );
}

function HardwareSection({ icon: Icon, title, children }) {
  return (
    <section className="hardware-detail-section">
      <header>
        <Icon size={18} aria-hidden="true" />
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "Nao informado";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = bytes;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(unitIndex >= 3 ? 1 : 0)} ${units[unitIndex]}`;
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return "Nao informado";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? `${days} d ${hours} h` : `${hours} h`;
}

function buildMetricAlert({ metric, label, value, warningLimit = 70, criticalLimit = 85 }) {
  if (value == null || value < warningLimit) return null;

  const isCritical = value >= criticalLimit;
  return {
    id: `metric-${metric}`,
    description: `${label} acima do limite: ${value}%`,
    detectedAt: new Date().toISOString(),
    type: "Métrica",
    severity: isCritical ? "Crítico" : "Atenção",
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
      description: "Máquina não responde ping",
      detectedAt: machine.lastPingAt || new Date().toISOString(),
      type: "Conectividade",
      severity: "Crítico",
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
      severity: alert.severity === "critical" ? "Crítico" : "Atenção",
      metric: alert.metric || "Monitoramento",
      value: alert.value || "Ativo",
      limit: alert.limit || "Regra de monitoramento",
      status: "Ativo"
    });
  }

  if (machine.status === "problem" && !alerts.length) {
    alerts.push({
      id: "monitoring-problem",
      description: "Alerta ativo no monitoramento",
      detectedAt: new Date().toISOString(),
      type: "Monitoramento",
      severity: "Atenção",
      metric: "Status",
      value: "Problema",
      limit: "Operação normal",
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
      type: "Histórico",
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
      return directHealth.status || directHealth.value || directHealth.health || "Não disponível";
    }
    return directHealth;
  }

  const diskWithHealth = (hardware.disks || []).find((disk) =>
    disk.health || disk.smartStatus || disk.healthPercent !== undefined || disk.status
  );

  if (!diskWithHealth) return "Não disponível";
  if (diskWithHealth.healthPercent !== undefined) return `${diskWithHealth.healthPercent}%`;
  return diskWithHealth.health || diskWithHealth.smartStatus || diskWithHealth.status || "Não disponível";
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
            <article key={alert.id} className={`error-alert-card ${alert.severity === "Crítico" ? "critical" : "warning"}`}>
              <header>
                <strong>{alert.description}</strong>
                <span>{alert.status}</span>
              </header>
              <dl>
                <div><dt>Detectado</dt><dd>{formatDate(alert.detectedAt)}</dd></div>
                <div><dt>Tipo</dt><dd>{alert.type}</dd></div>
                <div><dt>Severidade</dt><dd>{alert.severity}</dd></div>
                <div><dt>Métrica</dt><dd>{alert.metric}</dd></div>
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
          <h3>Resolvidos no histórico</h3>
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
  onAddPeripheral,
  onRemovePeripheral,
  canManage = false,
  onClose
}) {
  const [activeTab, setActiveTab] = useState("general");
  const hardware = machine?.hardware || {};
  const manualAsset = machine?.manualAsset;
  const isManualAsset = machine?.source === "manual";
  const isAgentAsset = isAgentMachine(machine);
  const agent = machine?.agent;
  const memoryModules = Array.isArray(hardware.memoryModules)
    ? hardware.memoryModules
    : Array.isArray(hardware.memoryHealth?.moduleDetails)
      ? hardware.memoryHealth.moduleDetails
      : [];
  const graphicsAdapters = Array.isArray(hardware.graphics) ? hardware.graphics : [];
  const disks = Array.isArray(hardware.disks) ? hardware.disks : [];
  const inMaintenance = Boolean(machine?.maintenance) || isMaintenanceSegmentName(machine?.segmentName);
  const backupInUse = machine?.backupStatus === "in_use";
  const latestChange = useMemo(
    () => [...(machine?.assetHistory || []), ...(hardware.changeHistory || [])][0],
    [hardware.changeHistory, machine?.assetHistory]
  );
  const activeAlerts = useMemo(() => buildActiveAlerts(machine), [machine]);
  const resolvedAlerts = useMemo(() => buildResolvedAlerts(machine, hardware), [hardware, machine]);
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => {
      if (tab.id === "alerts") return activeAlerts.length > 0 || resolvedAlerts.length > 0;
      return true;
    }),
    [activeAlerts.length, resolvedAlerts.length]
  );
  const softwareRows = useMemo(
    () => (Array.isArray(hardware.software) ? hardware.software : []).map(normalizeSoftware),
    [hardware.software]
  );
  const diskHealth = useMemo(() => getDiskHealth(hardware), [hardware]);
  const sourceCollections = useMemo(
    () => getMachineSourceCollections(machine),
    [machine]
  );

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("general");
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (!machine) return undefined;

    function handleKeydown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [machine, onClose]);

  if (!machine) return null;

  return (
    <div className="modal-backdrop asset-modal-backdrop" role="presentation">
      <section className="asset-modal" role="dialog" aria-modal="true" aria-label="Detalhes do ativo">
        <header className="asset-modal-header">
          <div>
            <span className="asset-eyebrow">
              {isAgentAsset ? "Maquina real" : isManualAsset ? "Ativo de rede manual" : "Inventario integrado"}
            </span>
            <h2>{alias || machine.name}</h2>
            <p>{machine.name} - {machine.ip}</p>
            <AutomationIndicatorDots indicators={machine.automationIndicators} maxVisible={4} />
          </div>
          <div className="asset-modal-header-actions">
            <button
              type="button"
              className={`ghost-action maintenance-action ${inMaintenance ? "active" : ""}`}
              onClick={onPutMaintenance}
              title={inMaintenance ? "Retirar da manutenção" : "Colocar em manutenção"}
            >
              <Wrench size={15} />
              {inMaintenance ? "Retirar da manutenção" : "Colocar em manutenção"}
            </button>
            <button
              type="button"
              className={`ghost-action backup-action ${machine?.isBackup ? "active" : ""}`}
              onClick={() => onToggleBackup?.(!machine?.isBackup)}
              disabled={backupInUse}
              title={backupInUse ? "Backup em uso por uma OS" : machine?.isBackup ? "Remover da área de Backup" : "Marcar como Backup"}
            >
              <Archive size={15} />
              {backupInUse ? "Backup em uso" : machine?.isBackup ? "Remover Backup" : "Marcar Backup"}
            </button>
            <button type="button" className="ghost-action danger-action" onClick={onRemoveMachine} title="Remover máquina do inventário">
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
                {isAgentAsset ? (
                  <>
                    <article>
                      <Clock3 size={18} />
                      <span>Ultima comunicacao</span>
                      <strong>{formatDate(agent?.lastSeenAt || machine.lastSeenAt)}</strong>
                    </article>
                    <article>
                      <Network size={18} />
                      <span>Versao do coletor</span>
                      <strong>{agent?.agentVersion || "Nao informada"}</strong>
                    </article>
                    <article>
                      <HardDrive size={18} />
                      <span>Disco livre</span>
                      <strong>{formatBytes(agent?.diskFreeBytes)}</strong>
                    </article>
                  </>
                ) : isManualAsset ? (
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
                ) : (
                  <>
                    <article>
                      <Cpu size={18} />
                      <span>CPU</span>
                      <strong>{machine.metrics?.cpu == null ? "Nao disponivel" : `${machine.metrics.cpu}%`}</strong>
                    </article>
                    <article>
                      <MemoryStick size={18} />
                      <span>RAM</span>
                      <strong>{machine.metrics?.ram == null ? "Nao disponivel" : `${machine.metrics.ram}%`}</strong>
                    </article>
                    <article>
                      <HardDrive size={18} />
                      <span>Disco</span>
                      <strong>{machine.metrics?.disk == null ? "Nao disponivel" : `${machine.metrics.disk}%`}</strong>
                    </article>
                    <article>
                      <HardDrive size={18} />
                      <span>Saúde do disco</span>
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
                {isAgentAsset && (
                  <>
                    <DetailItem label="Intervalo de coleta" value={agent?.intervalSeconds ? `${agent.intervalSeconds} s` : null} />
                    <DetailItem label="Coletado em" value={formatDate(agent?.collectedAt)} />
                    <DetailItem label="Ambiente informado" value={agent?.environment} />
                    <DetailItem label="Grupo informado" value={agent?.group} />
                    <DetailItem label="Segmento informado" value={agent?.segment} />
                  </>
                )}
                {sourceCollections.map((collection) => (
                  <DetailItem
                    key={collection.source}
                    label={`Ultima coleta ${collection.label}`}
                    value={formatDate(collection.collectedAt)}
                  />
                ))}
                {Boolean(machine.sourceConflicts?.length) && (
                  <DetailItem
                    label="Correlacao entre fontes"
                    value="Conflito pendente de revisao"
                  />
                )}
              </div>

              {latestChange && (
                <div className="latest-change">
                  <strong>Última alteração detectada</strong>
                  <span>{latestChange.change || latestChange.message} em {formatDate(latestChange.detectedAt || latestChange.createdAt)}</span>
                </div>
              )}

              <QRCodePrint machine={machine} alias={alias} />
            </section>
          )}

          {activeTab === "hardware" && (
            <section className="asset-tab-content hardware-detail-layout">
              <HardwareSection icon={Laptop} title="Sistema e equipamento">
                <div className="detail-grid hardware-detail-grid">
                  <DetailItem label="Hostname" value={machine.name} />
                  <DetailItem label="Sistema operacional" value={hardware.os} />
                  <DetailItem label="Versão do SO" value={hardware.osVersion || hardware.os} />
                  <DetailItem label="Arquitetura" value={hardware.architecture} />
                  <DetailItem label="Fabricante" value={hardware.manufacturer} />
                  <DetailItem label="Modelo" value={hardware.model} />
                  <DetailItem label="Serial number" value={hardware.serialNumber} />
                  {isAgentAsset && (
                    <>
                      <DetailItem label="Uptime" value={formatDuration(agent?.uptimeSeconds)} />
                      <DetailItem label="Usuário local" value={agent?.loggedUser || "Coleta desativada"} />
                    </>
                  )}
                </div>
              </HardwareSection>

              <HardwareSection icon={Cpu} title="Processador">
                <div className="detail-grid hardware-detail-grid">
                  <DetailItem label="Modelo" value={hardware.cpuModel || hardware.cpuDetails?.name} />
                  <DetailItem label="Núcleos físicos" value={hardware.cpuCores || hardware.cpuDetails?.cores} />
                  <DetailItem label="Processadores lógicos" value={hardware.cpuDetails?.logicalProcessors} />
                  <DetailItem label="Sockets" value={hardware.cpuDetails?.sockets} />
                  <DetailItem label="Socket" value={hardware.cpuDetails?.socket} />
                  <DetailItem
                    label="Clock máximo"
                    value={hardware.cpuDetails?.maxClockMhz ? `${hardware.cpuDetails.maxClockMhz} MHz` : null}
                  />
                  <DetailItem
                    label="Virtualização"
                    value={hardware.cpuDetails?.virtualizationEnabled == null
                      ? null
                      : hardware.cpuDetails.virtualizationEnabled}
                  />
                </div>
              </HardwareSection>

              <HardwareSection icon={MemoryStick} title="Memória">
                <div className="detail-grid hardware-detail-grid">
                  <DetailItem label="Total instalado" value={hardware.ramGb ? `${hardware.ramGb} GB` : null} />
                  {isAgentAsset && <DetailItem label="Total detectado" value={formatBytes(agent?.memoryTotalBytes)} />}
                  <DetailItem label="Saúde geral" value={hardware.memoryHealth?.status || hardware.memoryHealth} />
                  <DetailItem
                    label="Módulos detectados"
                    value={memoryModules.length || hardware.memoryHealth?.modules}
                  />
                </div>
                <div className="hardware-component-list">
                  {memoryModules.map((module, index) => (
                    <article key={`${module.bank || "memory"}-${module.serialNumber || index}`}>
                      <header>
                        <MemoryStick size={16} aria-hidden="true" />
                        <strong>{module.bank || `Módulo ${index + 1}`}</strong>
                        <span>{formatHardwareValue(module.status, "Status não informado")}</span>
                      </header>
                      <dl>
                        <div><dt>Capacidade</dt><dd>{formatHardwareValue(module.capacityGb ? `${module.capacityGb} GB` : null)}</dd></div>
                        <div><dt>Velocidade</dt><dd>{formatHardwareValue(module.speedMhz ? `${module.speedMhz} MHz` : null)}</dd></div>
                        <div><dt>Fabricante</dt><dd>{formatHardwareValue(module.manufacturer)}</dd></div>
                        <div><dt>Part number</dt><dd>{formatHardwareValue(module.partNumber)}</dd></div>
                        <div><dt>Serial</dt><dd>{formatHardwareValue(module.serialNumber)}</dd></div>
                      </dl>
                    </article>
                  ))}
                  {!memoryModules.length && <p className="empty">Nenhum módulo individual identificado.</p>}
                </div>
              </HardwareSection>

              <HardwareSection icon={Monitor} title="Vídeo">
                <div className="hardware-component-list">
                  {graphicsAdapters.map((adapter, index) => (
                    <article key={`${adapter.name || "graphics"}-${index}`}>
                      <header>
                        <Monitor size={16} aria-hidden="true" />
                        <strong>{formatHardwareValue(adapter.name, `Adaptador ${index + 1}`)}</strong>
                        <span>{formatHardwareValue(adapter.status, "Status não informado")}</span>
                      </header>
                      <dl>
                        <div><dt>Processador gráfico</dt><dd>{formatHardwareValue(adapter.videoProcessor)}</dd></div>
                        <div><dt>Memória</dt><dd>{formatHardwareValue(adapter.memoryBytes ? formatBytes(adapter.memoryBytes) : null)}</dd></div>
                        <div><dt>Driver</dt><dd>{formatHardwareValue(adapter.driverVersion)}</dd></div>
                        <div><dt>Resolução</dt><dd>{formatHardwareValue(adapter.resolution)}</dd></div>
                      </dl>
                    </article>
                  ))}
                  {!graphicsAdapters.length && <p className="empty">Nenhum adaptador de vídeo identificado.</p>}
                </div>
              </HardwareSection>

              <HardwareSection icon={CircuitBoard} title="Placa-mãe">
                <div className="detail-grid hardware-detail-grid">
                  <DetailItem label="Fabricante" value={hardware.motherboard?.manufacturer} />
                  <DetailItem label="Produto" value={hardware.motherboard?.product} />
                  <DetailItem label="Versão" value={hardware.motherboard?.version} />
                  <DetailItem label="Serial" value={hardware.motherboard?.serialNumber} />
                  <DetailItem label="Status" value={hardware.motherboard?.status} />
                </div>
              </HardwareSection>

              <HardwareSection icon={HardDrive} title="Armazenamento">
                <div className="detail-grid hardware-detail-grid">
                  {isAgentAsset && (
                    <>
                      <DetailItem label="Total" value={formatBytes(agent?.diskTotalBytes)} />
                      <DetailItem label="Livre" value={formatBytes(agent?.diskFreeBytes)} />
                    </>
                  )}
                  <DetailItem label="Saúde geral" value={diskHealth} />
                  <DetailItem label="Unidades detectadas" value={disks.length} />
                </div>
                <div className="disk-detail-list">
                  {disks.map((disk, index) => (
                    <article key={`${disk.label || "disk"}-${index}`}>
                      <HardDrive size={16} aria-hidden="true" />
                      <strong>{formatHardwareValue(disk.label, `Disco ${index + 1}`)}</strong>
                      <span>{formatHardwareValue(disk.sizeGb ? `${disk.sizeGb} GB - ${disk.type || "tipo não informado"}` : disk.type)}</span>
                      <small>SMART: {formatHardwareValue(disk.smartStatus || disk.health)}</small>
                      <small>Saúde estimada: {formatHardwareValue(disk.healthEstimate || (disk.healthPercent != null ? `${disk.healthPercent}% (estimativa)` : null))}</small>
                      <small>Temperatura: {formatHardwareValue(disk.temperatureC ? `${disk.temperatureC} C` : null)}</small>
                      <small>Horas ligadas: {formatHardwareValue(disk.powerOnHours)}</small>
                      <small>Setores realocados: {formatHardwareValue(disk.reallocatedSectors)}</small>
                      <small>TB escritos: {formatHardwareValue(disk.tbWritten)}</small>
                    </article>
                  ))}
                  {!disks.length && (
                    <p className="empty">
                      {isManualAsset
                        ? "Ativo de rede sem coleta automática de discos."
                        : "Nenhuma unidade física identificada."}
                    </p>
                  )}
                </div>
              </HardwareSection>

              <HardwareSection icon={Battery} title="Energia">
                <div className="detail-grid hardware-detail-grid">
                  <DetailItem label="Bateria" value={hardware.battery?.name} />
                  <DetailItem
                    label="Carga"
                    value={hardware.battery?.chargePercent != null ? `${hardware.battery.chargePercent}%` : null}
                  />
                  <DetailItem label="Status" value={hardware.battery?.status} />
                  <DetailItem
                    label="Autonomia estimada"
                    value={hardware.battery?.estimatedMinutes
                      ? `${hardware.battery.estimatedMinutes} min`
                      : null}
                  />
                </div>
              </HardwareSection>

              <HardwareSection icon={KeyRound} title="Licenciamento">
                <div className="detail-grid hardware-detail-grid">
                  <DetailItem label="Licença Windows" value={hardware.licenses?.windowsKey || hardware.windowsKey} />
                  <DetailItem label="Office" value={hardware.licenses?.officeVersion || hardware.officeVersion} />
                  <DetailItem label="Licença Office" value={hardware.licenses?.officeKey || hardware.officeKey} />
                </div>
              </HardwareSection>

              <div className="license-note">
                <KeyRound size={16} />
                <span>Licenças e saúde física dependem dos dados disponibilizados pelo Windows e pelas fontes integradas.</span>
              </div>
            </section>
          )}

          {activeTab === "alerts" && (
            <ErrorAlertList alerts={activeAlerts} resolvedAlerts={resolvedAlerts} />
          )}

          {activeTab === "software" && (
            <section className="asset-tab-content">
              <div className="software-table-list">
                {softwareRows.map((software, index) => (
                  <article key={`${software.name}-${software.version || "sem-versao"}-${index}`}>
                    <strong>{software.name}</strong>
                    <span>Versão: {software.version || "Não disponível"}</span>
                    <span>Fabricante: {software.manufacturer || "Não disponível"}</span>
                    <span>Instalação: {software.installedAt ? formatDate(software.installedAt) : "Não disponível"}</span>
                  </article>
                ))}
              </div>
              {!softwareRows.length && !isManualAsset && <p className="empty">Nenhum software coletado para esta maquina.</p>}
              {isManualAsset && <p className="empty">Softwares não se aplicam a este ativo manual.</p>}
            </section>
          )}

          {activeTab === "network" && (
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
                <span>
                  {isAgentAsset
                    ? "IP e MAC coletados localmente pelo Agente IT Guardian. Tráfego de rede não é coletado."
                    : isManualAsset
                      ? "Status preparado para ping real; o MVP usa simulação separada no backend."
                      : "Telemetria fornecida pela fonte de monitoramento configurada"}
                </span>
              </div>
            </section>
          )}

          {activeTab === "peripherals" && (
            <section className="asset-tab-content">
              {isManualAsset ? (
                <div className="network-card">
                  <AssetTypeIcon type={machine.assetType} size={18} />
                  <span>Ativos de rede não são periféricos USB. Eles possuem IP próprio e aparecem como itens independentes.</span>
                </div>
              ) : (
                <PeripheralList
                  peripherals={hardware.peripherals || []}
                  segmentColor={segmentColor}
                  canManage={canManage}
                  allowAdd={canManage}
                  onAdd={onAddPeripheral}
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
