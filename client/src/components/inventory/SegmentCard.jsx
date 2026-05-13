import { ChevronDown, Edit3, Trash2 } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import MachineCard from "./MachineCard.jsx";
import ColorPickerSegment from "./ColorPickerSegment.jsx";

export default function SegmentCard({
  segment,
  machines,
  segments,
  aliases,
  canManage,
  onRename,
  onDelete,
  onColorChange,
  onMoveMachine,
  onOpenDetails,
  onOpenMoveModal,
  onRefreshPing
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `segment-${segment.id}`,
    data: { type: "segment", segmentId: segment.id }
  });
  const [collapsed, setCollapsed] = useState(false);
  const color = segment.color || "#1f7a61";
  const machineIds = machines.map((machine) => machine.id);

  return (
    <section
      id={`inventory-segment-${segment.id}`}
      ref={setNodeRef}
      className={`segment-card ${isOver ? "drop-over" : ""}`}
      style={{ "--segment-color": color }}
    >
      <header className="segment-card-header">
        <div className="segment-title-row">
          <span className="segment-color-mark" />
          <div>
            <h3>{segment.name}</h3>
            <span>{machines.length} maquinas</span>
          </div>
        </div>

        <div className="segment-header-tools">
          <ColorPickerSegment
            color={color}
            disabled={!canManage || segment.isDefault}
            onChange={(nextColor) => onColorChange(segment, nextColor)}
          />
          {canManage && (
            <>
              <button
                type="button"
                disabled={segment.isDefault}
                onClick={() => onRename(segment)}
                title={segment.isDefault ? "Segmento padrao nao pode ser renomeado" : "Renomear segmento"}
              >
                <Edit3 size={15} />
              </button>
              <button
                type="button"
                disabled={segment.isDefault}
                onClick={() => onDelete(segment)}
                title={segment.isDefault ? "Segmento padrao nao pode ser excluido" : "Excluir segmento"}
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
          <button
            type="button"
            className={`segment-collapse ${collapsed ? "collapsed" : ""}`}
            title={collapsed ? "Expandir segmento" : "Recolher segmento"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </header>

      {!collapsed && (
        <SortableContext items={machineIds} strategy={rectSortingStrategy}>
          <div className="segment-machine-grid">
            {machines.map((machine) => (
              <MachineCard
                key={machine.id}
                machine={machine}
                segments={segments}
                canManage={canManage}
                segmentColor={color}
                alias={aliases[machine.id]}
                onMoveMachine={onMoveMachine}
                onOpenDetails={onOpenDetails}
                onOpenMoveModal={onOpenMoveModal}
                onRefreshPing={onRefreshPing}
              />
            ))}
            {!machines.length && (
              <div className="empty-segment wide-empty">
                <span>Solte maquinas aqui</span>
              </div>
            )}
          </div>
        </SortableContext>
      )}
    </section>
  );
}
