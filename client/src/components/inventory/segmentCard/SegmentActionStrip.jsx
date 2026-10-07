import { ArrowDown, ArrowUp, ChevronDown, Edit3, Trash2 } from "lucide-react";
import ColorPickerSegment from "../ColorPickerSegment.jsx";

export default function SegmentActionStrip({
  segment,
  color,
  collapsed,
  canManage,
  canMoveSegmentUp,
  canMoveSegmentDown,
  onToggleCollapsed,
  closeActions,
  onMoveSegmentOrder,
  onColorChange,
  onRename,
  onDelete
}) {
  return (
    <div className="inline-action-strip segment-inline-actions" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="inline-action-button"
        onClick={() => {
          onToggleCollapsed();
          closeActions();
        }}
        title={collapsed ? "Expandir segmento" : "Recolher segmento"}
        aria-label={collapsed ? "Expandir segmento" : "Recolher segmento"}
      >
        <ChevronDown size={15} className={collapsed ? "rotated" : ""} />
      </button>
      {canManage && canMoveSegmentUp && (
        <button
          type="button"
          className="inline-action-button"
          onClick={() => {
            onMoveSegmentOrder?.(segment, "up");
            closeActions();
          }}
          title="Subir segmento"
          aria-label="Subir segmento"
        >
          <ArrowUp size={15} />
        </button>
      )}
      {canManage && canMoveSegmentDown && (
        <button
          type="button"
          className="inline-action-button"
          onClick={() => {
            onMoveSegmentOrder?.(segment, "down");
            closeActions();
          }}
          title="Descer segmento"
          aria-label="Descer segmento"
        >
          <ArrowDown size={15} />
        </button>
      )}
      {canManage && <ColorPickerSegment color={color} disabled={!canManage} onChange={(nextColor) => onColorChange(segment, nextColor)} />}
      {canManage && (
        <button
          type="button"
          className="inline-action-button"
          onClick={() => {
            onRename(segment);
            closeActions();
          }}
          title="Renomear segmento"
          aria-label="Renomear segmento"
        >
          <Edit3 size={15} />
        </button>
      )}
      {canManage && (
        <button
          type="button"
          className="inline-action-button danger"
          onClick={() => {
            onDelete(segment);
            closeActions();
          }}
          title="Excluir segmento"
          aria-label="Excluir segmento"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
