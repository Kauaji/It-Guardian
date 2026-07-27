import { ChevronDown, Clock3, Cpu, HardDrive, Info, MemoryStick, MoveRight } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { useRef } from "react";
import AssetTypeIcon from "./AssetTypeIcon.jsx";
import { assetTypeLabel } from "./assetTypes.js";
import PeripheralList from "./PeripheralList.jsx";
import SelectionCheckbox from "./SelectionCheckbox.jsx";
import AutomationIndicatorDots from "../AutomationIndicatorDots.jsx";
import {
  getAgentHeartbeatState,
  getMachineSourceLabel,
  isAgentMachine
} from "./agentPresentation.js";

const pingTimeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function statusLabel(status) {
  return {
    online: "Online",
    offline: "Erro",
    problem: "Problema"
  }[status] || "Desconhecido";
}

function statusTone(status) {
  return {
    online: "online",
    offline: "error",
    problem: "unknown"
  }[status] || "unknown";
}

function metricTone(value) {
  if (value >= 85) return "danger";
  if (value >= 70) return "warning";
  return "ok";
}

function formatAgentHeartbeat(value) {
  if (!value) return "Sem comunicacao";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function DiskIndicator({ value }) {
  if (value == null) return null;
  return (
    <span className={`disk-indicator ${metricTone(value)}`} title={`Disco ${value}%`}>
      <HardDrive size={12} />
      {value}%
    </span>
  );
}

function MachineCardContent({
  machine,
  segments = [],
  canManage = false,
  dragHandleProps = {},
  segmentColor,
  alias,
  selected = false,
  selectionCount = 0,
  isDragging = false,
  isOverlay = false,
  onMoveMachine = () => {},
  onOpenDetails = () => {},
  onRefreshPing = () => {},
  onSelect = () => {},
  onToggleSelection = () => {},
  onRemovePeripheral = () => {},
  activePopoverId = null,
  setActivePopoverId = () => {},
  setNodeRef,
  style
}) {
  const menuRef = useRef(null);
  const detailsRef = useRef(null);
  const movePopoverId = `move-${machine.id}`;
  const detailsPopoverId = `peripherals-${machine.id}`;
  const moveMenuOpen = activePopoverId === movePopoverId;
  const expanded = activePopoverId === detailsPopoverId;
  const availableSegments = segments.filter((segment) => segment.id !== machine.segmentId && !segment.isBackupSegment);
  const showMoveMenu = availableSegments.length > 0;
  const showDetails = true;
  const isManualAsset = machine.source === "manual";
  const isAgentAsset = isAgentMachine(machine);
  const agentHeartbeat = getAgentHeartbeatState(machine);
  const isBackup = Boolean(machine.isBackup);
  const backupInUse = machine.backupStatus === "in_use";
  const metrics = machine.metrics || {};
  const typeLabel = assetTypeLabel(machine.assetType || machine.type);
  const { onPointerDown: onDragPointerDown, ...safeDragHandleProps } = dragHandleProps;
  const lastPing = machine.lastPingAt
    ? pingTimeFormatter.format(new Date(machine.lastPingAt))
    : "--:--";

  function moveToSegment(segmentId) {
    setActivePopoverId(null);
    onMoveMachine(machine, segmentId);
  }

  function handleCardClick(event) {
    if (isOverlay) return;
    setActivePopoverId(null);
    onSelect(machine, { additive: event.ctrlKey || event.metaKey });
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`machine-card ${isBackup ? "backup-card" : ""} ${backupInUse ? "backup-in-use" : ""} ${selected ? "selected" : ""} ${expanded ? "details-open" : ""} ${moveMenuOpen ? "move-menu-open" : ""} ${isDragging ? "dragging" : ""} ${isOverlay ? "drag-overlay" : ""}`}
      onClick={handleCardClick}
    >
      {!isOverlay && (
        <SelectionCheckbox checked={selected} onToggle={() => onToggleSelection(machine.id)} />
      )}
      {isOverlay && selectionCount > 1 && (
        <span className="drag-selection-badge">+{selectionCount - 1} equipamentos</span>
      )}
      <div className="machine-card-header">
        <div>
          <button
            className="asset-drag-handle"
            type="button"
            {...safeDragHandleProps}
            title="Arrastar ativo"
            onPointerDown={(event) => {
              setActivePopoverId(null);
              onDragPointerDown?.(event);
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <AssetTypeIcon type={machine.assetType || machine.type} size={16} />
          </button>
          <strong>{alias || machine.name}</strong>
        </div>
      </div>
      <div className="machine-badge-row">
        {isManualAsset ? (
          <button
            type="button"
            className={`status-dot status-action ${statusTone(machine.status)}`}
            disabled={!canManage}
            onClick={(event) => {
              event.stopPropagation();
              setActivePopoverId(null);
              onRefreshPing(machine);
            }}
            title="Atualizar ping"
          >
            {statusLabel(machine.status)}
          </button>
        ) : (
          <span className={`status-dot ${statusTone(machine.status)}`}>{statusLabel(machine.status)}</span>
        )}
        <span className="asset-type-badge">{typeLabel}</span>
        <span className="machine-source-badge">{getMachineSourceLabel(machine)}</span>
        {isAgentAsset && <span className="agent-origin-badge">Maquina real</span>}
        {isBackup && (
          <span className={`backup-badge ${backupInUse ? "in-use" : "available"}`}>
            {backupInUse ? "Backup em uso" : "Backup disponivel"}
          </span>
        )}
        <AutomationIndicatorDots indicators={machine.automationIndicators} compact maxVisible={4} />
      </div>
      <span className="machine-ip">{machine.ip}</span>
      {machine.inventorySearchTabName && (
        <span className="machine-search-tab" title={`Aba: ${machine.inventorySearchTabName}`}>
          Aba: {machine.inventorySearchTabName}
        </span>
      )}

      {isManualAsset ? (
        <div className="network-asset-facts">
          <div>
            <span>Marca/modelo</span>
            <strong>{machine.manualAsset?.brand} {machine.manualAsset?.model}</strong>
          </div>
          <div>
            <span>Patrimônio</span>
            <strong>{machine.manualAsset?.assetTag}</strong>
          </div>
          <div>
            <span><Clock3 size={13} /> Ping</span>
            <strong>{lastPing}</strong>
          </div>
        </div>
      ) : isAgentAsset ? (
        <div className="agent-card-facts">
          <div>
            <span><Clock3 size={13} /> Ultima comunicacao</span>
            <strong>{formatAgentHeartbeat(agentHeartbeat.lastSeenAt)}</strong>
          </div>
          <div>
            <span>Agente</span>
            <strong>v{machine.agent?.agentVersion || "Nao informada"}</strong>
          </div>
          {agentHeartbeat.status === "offline" && (
            <p className="agent-heartbeat-warning">Sem heartbeat no intervalo esperado</p>
          )}
        </div>
      ) : (
        <div className="machine-metrics">
          <div>
            <span><Cpu size={13} /> CPU</span>
            <strong className={metricTone(metrics.cpu)}>{metrics.cpu}%</strong>
          </div>
          <div>
            <span><MemoryStick size={13} /> RAM</span>
            <strong className={metricTone(metrics.ram)}>{metrics.ram}%</strong>
          </div>
        </div>
      )}

      {showDetails && (
        <div className="machine-card-actions">
          {!isManualAsset && metrics?.disk != null && <DiskIndicator value={metrics.disk} />}
          <div className="details-menu">
            <button
              type="button"
              className={`details-toggle ${expanded ? "expanded" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setActivePopoverId(expanded ? null : detailsPopoverId);
              }}
              aria-label="Perifericos"
              aria-expanded={expanded}
              title={expanded ? "Ocultar perifericos" : "Perifericos"}
            >
              <ChevronDown size={15} />
            </button>
            {showDetails && (
              <div
                ref={detailsRef}
                className={`machine-details ${expanded ? "expanded" : ""}`}
                onClick={(event) => event.stopPropagation()}
              >
                {isManualAsset ? (
                  <div className="manual-asset-mini">
                    <span>{machine.manualAsset?.location || "Sem localizacao"}</span>
                    <strong>{machine.manualAsset?.hostname || machine.manualAsset?.macAddress || "Sem hostname/MAC"}</strong>
                  </div>
                ) : isAgentAsset ? (
                  <div className="manual-asset-mini agent-asset-mini">
                    <span>{machine.agent?.operatingSystem || "Sistema nao informado"}</span>
                    <strong>{machine.agent?.localIp || machine.ip} · {machine.agent?.osArchitecture || "Arquitetura nao informada"}</strong>
                  </div>
                ) : (
                  <PeripheralList
                    peripherals={machine.hardware?.peripherals || []}
                    segmentColor={segmentColor}
                    canManage={canManage}
                    onRemove={(peripheral) => onRemovePeripheral(machine.id, peripheral)}
                  />
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setActivePopoverId(null);
              onOpenDetails(machine);
            }}
            aria-label="Ficha"
            title="Ficha"
          >
            <Info size={15} />
          </button>
          {showMoveMenu && (
            <div className="move-menu" ref={menuRef}>
              <button
                type="button"
                disabled={!canManage}
                onClick={(event) => {
                  event.stopPropagation();
                  setActivePopoverId(moveMenuOpen ? null : movePopoverId);
                }}
                aria-label="Mover"
                title="Mover"
              >
                <MoveRight size={15} />
              </button>
              {moveMenuOpen && (
                <div className="move-menu-popover" onClick={(event) => event.stopPropagation()}>
                  {availableSegments.map((segment) => (
                    <button
                      key={segment.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        moveToSegment(segment.id);
                      }}
                    >
                      <span style={{ backgroundColor: segment.color || "#1f7a61" }} />
                      {segment.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </article>
  );
}

export default function MachineCard({
  machine,
  segments,
  canManage,
  segmentColor,
  alias,
  selected,
  onMoveMachine,
  onOpenDetails,
  onOpenMoveModal,
  onRefreshPing,
  onSelect,
  onToggleSelection,
  onRemovePeripheral,
  activePopoverId,
  setActivePopoverId
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: machine.id,
    data: { type: "machine", machineId: machine.id, segmentId: machine.segmentId }
  });

  const style = {
    transform: undefined,
    transition: undefined
  };

  return (
    <MachineCardContent
      machine={machine}
      segments={segments}
      canManage={canManage}
      segmentColor={segmentColor}
      alias={alias}
      selected={selected}
      onMoveMachine={onMoveMachine}
      onOpenDetails={onOpenDetails}
      onOpenMoveModal={onOpenMoveModal}
      onRefreshPing={onRefreshPing}
      onSelect={onSelect}
      onToggleSelection={onToggleSelection}
      onRemovePeripheral={onRemovePeripheral}
      activePopoverId={activePopoverId}
      setActivePopoverId={setActivePopoverId}
      dragHandleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      setNodeRef={setNodeRef}
      style={style}
    />
  );
}
