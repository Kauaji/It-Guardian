import { ArrowDown, ArrowUp, ChevronDown, Copy, Edit3, MoreHorizontal, Trash2 } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import MachineCard from "./MachineCard.jsx";
import ColorPickerSegment from "./ColorPickerSegment.jsx";

export default function SegmentCard({
  segment,
  machines,
  segments,
  groups = [],
  aliases,
  selectedAssetIds = new Set(),
  canManage,
  onRename,
  onDelete,
  onDuplicate,
  onColorChange,
  onMoveMachine,
  onOpenDetails,
  onOpenMoveModal,
  onRefreshPing,
  onSelectAsset,
  onToggleSelection,
  onMoveSegmentToGroup,
  onMoveSegmentOrder,
  canMoveSegmentUp,
  canMoveSegmentDown,
  hideGroupSelect = false,
  selected = false,
  onSelectSegment,
  onRemovePeripheral,
  activePopoverId,
  setActivePopoverId
}) {
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({
    id: `segment-drop-${segment.id}`,
    data: { type: "segment", segmentId: segment.id }
  });
  const {
    attributes: segmentDragAttributes,
    listeners: segmentDragListeners,
    setNodeRef: setSegmentDragNodeRef,
    isDragging: isSegmentDragging
  } = useDraggable({
    id: `segment-drag-${segment.id}`,
    data: { type: "segment", segmentId: segment.id, origin: "board" },
    disabled: segment.isDefault || !canManage
  });
  const [collapsed, setCollapsed] = useState(false);
  const isDefaultSegment = Boolean(segment.isDefault);
  const color = isDefaultSegment ? "#64748b" : segment.color || "#1f7a61";
  const machineIds = machines.map((machine) => machine.id);
  const actionsMenuId = `segment-actions-${segment.id}`;
  const actionsOpen = activePopoverId === actionsMenuId;
  const sectionStyle = {
    "--segment-color": color,
    opacity: isSegmentDragging ? 0.62 : undefined
  };

  function closeActions() {
    setActivePopoverId?.(null);
  }

  function handleSegmentTitleClick(event) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectSegment?.(segment.id, true);
  }

  return (
    <section
      id={`inventory-segment-${segment.id}`}
      ref={(node) => {
        setDropNodeRef(node);
      }}
      className={`segment-card ${isDefaultSegment ? "default-segment-card" : ""} ${isOver ? "drop-over" : ""} ${isSegmentDragging ? "segment-dragging" : ""} ${selected ? "segment-selected" : ""}`}
      style={sectionStyle}
    >
      <header className="segment-card-header">
        <div className="segment-title-row">
          <button
            type="button"
            ref={setSegmentDragNodeRef}
            className={`segment-title-drag-handle ${isSegmentDragging ? "dragging" : ""}`}
            title={isDefaultSegment ? "Segmento padrao nao pode ser movido" : "Mover segmento"}
            disabled={isDefaultSegment || !canManage}
            {...segmentDragAttributes}
            {...segmentDragListeners}
            onClick={handleSegmentTitleClick}
            onPointerDown={(event) => {
              setActivePopoverId?.(null);
              segmentDragListeners?.onPointerDown?.(event);
            }}
          >
            <span className="segment-color-mark" aria-hidden="true" />
            <span className="segment-title-copy">
              <h3>{segment.name}</h3>
              <span>{machines.length} maquinas</span>
            </span>
          </button>
        </div>

        <div className="segment-header-tools">
          {isDefaultSegment ? (
            <button
              type="button"
              className={`segment-collapse ${collapsed ? "collapsed" : ""}`}
              title={collapsed ? "Expandir segmento" : "Recolher segmento"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((current) => !current)}
            >
              <ChevronDown size={16} />
            </button>
          ) : (
            <div className="segment-actions-menu-wrap">
              <button
                type="button"
                className="segment-options-trigger"
                title="Acoes do segmento"
                aria-label="Acoes do segmento"
                aria-expanded={actionsOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setActivePopoverId(actionsOpen ? null : actionsMenuId);
                }}
              >
                <MoreHorizontal size={16} />
              </button>
              {actionsOpen && (
                <div className="action-menu-popover segment-actions-menu" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="action-menu-item"
                    onClick={() => {
                      setCollapsed((current) => !current);
                      closeActions();
                    }}
                  >
                    <ChevronDown size={15} className={collapsed ? "rotated" : ""} />
                    {collapsed ? "Expandir segmento" : "Recolher segmento"}
                  </button>
                  {canManage && canMoveSegmentUp && (
                    <button
                      type="button"
                      className="action-menu-item"
                      onClick={() => {
                        onMoveSegmentOrder?.(segment, "up");
                        closeActions();
                      }}
                    >
                      <ArrowUp size={15} />
                      Subir segmento
                    </button>
                  )}
                  {canManage && canMoveSegmentDown && (
                    <button
                      type="button"
                      className="action-menu-item"
                      onClick={() => {
                        onMoveSegmentOrder?.(segment, "down");
                        closeActions();
                      }}
                    >
                      <ArrowDown size={15} />
                      Descer segmento
                    </button>
                  )}
                  {canManage && (
                    <div className="action-menu-item color-action" role="group" aria-label="Cor do segmento">
                      <span>Cor</span>
                      <ColorPickerSegment
                        color={color}
                        disabled={!canManage}
                        onChange={(nextColor) => onColorChange(segment, nextColor)}
                      />
                    </div>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="action-menu-item"
                      onClick={() => {
                        onRename(segment);
                        closeActions();
                      }}
                    >
                      <Edit3 size={15} />
                      Renomear
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="action-menu-item"
                      onClick={() => {
                        onDuplicate?.(segment);
                        closeActions();
                      }}
                    >
                      <Copy size={15} />
                      Copiar segmento
                    </button>
                  )}
                  {canManage && !hideGroupSelect && (
                    <label className="action-menu-select">
                      Grupo
                      <select
                        className="segment-group-select"
                        value={segment.groupId || groups.find((group) => (group.segmentIds || []).includes(segment.id))?.id || ""}
                        onChange={(event) => {
                          onMoveSegmentToGroup(segment.id, event.target.value);
                          closeActions();
                        }}
                        title="Mover segmento para grupo"
                      >
                        <option value="">Sem grupo</option>
                        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                      </select>
                    </label>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="action-menu-item danger"
                      onClick={() => {
                        onDelete(segment);
                        closeActions();
                      }}
                    >
                      <Trash2 size={15} />
                      Excluir
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
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
                selected={selectedAssetIds.has(machine.id)}
                onMoveMachine={onMoveMachine}
                onOpenDetails={onOpenDetails}
                onOpenMoveModal={onOpenMoveModal}
                onRefreshPing={onRefreshPing}
                onSelect={onSelectAsset}
                onToggleSelection={onToggleSelection}
                onRemovePeripheral={onRemovePeripheral}
                activePopoverId={activePopoverId}
                setActivePopoverId={setActivePopoverId}
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
