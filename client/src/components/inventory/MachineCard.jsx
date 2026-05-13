import { ChevronDown, Clock3, Cpu, Info, MemoryStick, MoveRight, RefreshCw } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import AssetTypeIcon from "./AssetTypeIcon.jsx";
import { assetTypeLabel } from "./assetTypes.js";
import PeripheralList from "./PeripheralList.jsx";

function statusLabel(status) {
  return {
    online: "Online",
    offline: "Offline",
    problem: "Problema"
  }[status] || "Desconhecido";
}

function statusTone(status) {
  return {
    online: "online",
    offline: "offline",
    problem: "unknown"
  }[status] || "unknown";
}

function metricTone(value) {
  if (value >= 85) return "danger";
  if (value >= 70) return "warning";
  return "ok";
}

function MachineCardContent({
  machine,
  segments = [],
  canManage = false,
  dragHandleProps = {},
  segmentColor,
  alias,
  isDragging = false,
  isOverlay = false,
  onMoveMachine = () => {},
  onOpenDetails = () => {},
  onOpenMoveModal = () => {},
  onRefreshPing = () => {},
  setNodeRef,
  style
}) {
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const menuRef = useRef(null);
  const availableSegments = segments.filter((segment) => segment.id !== machine.segmentId);
  const showMoveMenu = availableSegments.length > 0;
  const showDetails = true;
  const isManualAsset = machine.source === "manual";
  const metrics = machine.metrics || {};
  const typeLabel = assetTypeLabel(machine.assetType || machine.type);
  const lastPing = machine.lastPingAt
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(machine.lastPingAt))
    : "--:--";

  useEffect(() => {
    if (!moveMenuOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMoveMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [moveMenuOpen]);

  function moveToSegment(segmentId) {
    setMoveMenuOpen(false);
    onMoveMachine(machine, segmentId);
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`machine-card ${isDragging ? "dragging" : ""} ${isOverlay ? "drag-overlay" : ""}`}
    >
      <div className="machine-card-header">
        <div>
          <button className="asset-drag-handle" type="button" {...dragHandleProps} title="Arrastar ativo">
            <AssetTypeIcon type={machine.assetType || machine.type} size={16} />
          </button>
          <strong>{alias || machine.name}</strong>
        </div>
        <span className={`status-dot ${statusTone(machine.status)}`}>{statusLabel(machine.status)}</span>
      </div>
      <span className="machine-ip">{machine.ip} - {typeLabel}</span>

      {isManualAsset ? (
        <div className="network-asset-facts">
          <div>
            <span>Marca/modelo</span>
            <strong>{machine.manualAsset?.brand} {machine.manualAsset?.model}</strong>
          </div>
          <div>
            <span>Patrimonio</span>
            <strong>{machine.manualAsset?.assetTag}</strong>
          </div>
          <div>
            <span><Clock3 size={13} /> Ping</span>
            <strong>{lastPing}</strong>
          </div>
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

      {isManualAsset && machine.status === "offline" && (
        <p className="network-offline-note">{machine.pingMessage}</p>
      )}

      {showDetails && (
        <div className="machine-card-actions">
          {isManualAsset && (
            <button type="button" disabled={!canManage} onClick={() => onRefreshPing(machine)} title="Atualizar ping">
              <RefreshCw size={15} />
              Ping
            </button>
          )}
          {showMoveMenu && (
            <div className="move-menu" ref={menuRef}>
              <button
                type="button"
                disabled={!canManage}
                onClick={() => setMoveMenuOpen((current) => !current)}
                title="Mover maquina"
              >
                <MoveRight size={15} />
                Mover
              </button>
              {moveMenuOpen && (
                <div className="move-menu-popover">
                  {availableSegments.map((segment) => (
                    <button key={segment.id} type="button" onClick={() => moveToSegment(segment.id)}>
                      <span style={{ backgroundColor: segment.color || "#1f7a61" }} />
                      {segment.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className={`details-toggle ${expanded ? "expanded" : ""}`}
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            title={expanded ? "Ocultar perifericos" : "Mostrar perifericos"}
          >
            <ChevronDown size={15} />
            Perifericos
          </button>
          <button type="button" onClick={() => onOpenDetails(machine)} title="Abrir ficha completa">
            <Info size={15} />
            Ficha
          </button>
        </div>
      )}

      {showDetails && (
        <div className={`machine-details ${expanded ? "expanded" : ""}`}>
          {isManualAsset ? (
            <div className="manual-asset-mini">
              <span>{machine.manualAsset?.location || "Sem localizacao"}</span>
              <strong>{machine.manualAsset?.hostname || machine.manualAsset?.macAddress || "Sem hostname/MAC"}</strong>
            </div>
          ) : (
            <PeripheralList peripherals={machine.hardware?.peripherals || []} segmentColor={segmentColor} />
          )}
        </div>
      )}
    </article>
  );
}

export function MachineCardPreview({
  machine,
  segments = [],
  canManage = false,
  segmentColor,
  alias,
  overlayStyle
}) {
  if (!machine) return null;

  return (
    <MachineCardContent
      machine={machine}
      segments={segments}
      canManage={canManage}
      segmentColor={segmentColor}
      alias={alias}
      isOverlay
      style={overlayStyle}
    />
  );
}

export default function MachineCard({
  machine,
  segments,
  canManage,
  segmentColor,
  alias,
  onMoveMachine,
  onOpenDetails,
  onOpenMoveModal,
  onRefreshPing
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: machine.id,
    data: { type: "machine", machineId: machine.id, segmentId: machine.segmentId }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <MachineCardContent
      machine={machine}
      segments={segments}
      canManage={canManage}
      segmentColor={segmentColor}
      alias={alias}
      onMoveMachine={onMoveMachine}
      onOpenDetails={onOpenDetails}
      onOpenMoveModal={onOpenMoveModal}
      onRefreshPing={onRefreshPing}
      dragHandleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      setNodeRef={setNodeRef}
      style={style}
    />
  );
}
