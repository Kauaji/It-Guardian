import { ChevronDown, Info, MoveRight } from "lucide-react";
import RemoteAssistanceAction from "../../remoteAssistance/RemoteAssistanceAction.jsx";
import PeripheralList from "../PeripheralList.jsx";
import MetricBadge from "../metrics/MetricBadge.jsx";
import DiskIndicator from "./DiskIndicator.jsx";

function DetailsMenu({
  machine,
  expanded,
  detailsPopoverId,
  isManualAsset,
  canManage,
  segmentColor,
  setActivePopoverId,
  onAddPeripheral,
  onRemovePeripheral
}) {
  return (
    <div className="details-menu">
      <button
        type="button"
        className={`details-toggle ${expanded ? "expanded" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          setActivePopoverId(expanded ? null : detailsPopoverId);
        }}
        aria-label="Periféricos"
        aria-expanded={expanded}
        title={expanded ? "Ocultar periféricos" : "Periféricos"}
      >
        <ChevronDown size={15} />
      </button>
      <div className={`machine-details ${expanded ? "expanded" : ""}`} onClick={(event) => event.stopPropagation()}>
        {isManualAsset ? (
          <div className="manual-asset-mini">
            <span>{machine.manualAsset?.location || "Sem localização"}</span>
            <strong>{machine.manualAsset?.hostname || machine.manualAsset?.macAddress || "Sem hostname/MAC"}</strong>
          </div>
        ) : (
          <PeripheralList
            peripherals={machine.hardware?.peripherals || []}
            segmentColor={segmentColor}
            canManage={canManage}
            allowAdd={canManage}
            onAdd={(peripheral) => onAddPeripheral(machine.id, peripheral)}
            onRemove={(peripheral) => onRemovePeripheral(machine.id, peripheral)}
          />
        )}
      </div>
    </div>
  );
}

function MoveMenu({ availableSegments, moveMenuOpen, movePopoverId, canManage, setActivePopoverId, onMoveToSegment }) {
  return (
    <div className="move-menu">
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
                onMoveToSegment(segment.id);
              }}
            >
              <span style={{ backgroundColor: segment.color || "#1f7a61" }} />
              {segment.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MachineCardActions({ machine, alias, metrics, isManualAsset, flags, ids, availableSegments, handlers, context }) {
  const { canManage, segmentColor, token, user, notify } = context;
  const { setActivePopoverId, onOpenMetricModal, onOpenDetails, onMoveToSegment, onAddPeripheral, onRemovePeripheral } = handlers;
  return (
    <div className="machine-card-actions">
      {!isManualAsset && metrics?.disk != null && (
        <MetricBadge metric="disk" onOpenModal={onOpenMetricModal} className="metric-badge--disk">
          <DiskIndicator value={metrics.disk} />
        </MetricBadge>
      )}
      <RemoteAssistanceAction asset={machine} alias={alias} token={token} user={user} notify={notify} compact />
      <DetailsMenu
        machine={machine}
        expanded={flags.expanded}
        detailsPopoverId={ids.detailsPopoverId}
        isManualAsset={isManualAsset}
        canManage={canManage}
        segmentColor={segmentColor}
        setActivePopoverId={setActivePopoverId}
        onAddPeripheral={onAddPeripheral}
        onRemovePeripheral={onRemovePeripheral}
      />
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
      {availableSegments.length > 0 && (
        <MoveMenu
          availableSegments={availableSegments}
          moveMenuOpen={flags.moveMenuOpen}
          movePopoverId={ids.movePopoverId}
          canManage={canManage}
          setActivePopoverId={setActivePopoverId}
          onMoveToSegment={onMoveToSegment}
        />
      )}
    </div>
  );
}
