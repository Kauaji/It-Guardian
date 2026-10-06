import { ArrowDown, ArrowUp, ChevronDown, Edit3, Trash2 } from "lucide-react";
import ColorPickerSegment from "../ColorPickerSegment.jsx";

export default function GroupActionStrip({
  group, groupIndex, groupCount, activeTab, canManage, setActivePopoverId,
  onToggleGroup, onMoveGroupOrder, onChangeGroupColor, onRenameGroup, onDeleteGroup
}) {
  return (
    <div className="inline-action-strip group-inline-actions" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="inline-action-button"
        onClick={() => {
          onToggleGroup(group.id);
          setActivePopoverId(null);
        }}
        title={group.collapsed ? "Expandir grupo" : "Ocultar grupo"}
        aria-label={group.collapsed ? "Expandir grupo" : "Ocultar grupo"}
      >
        <ChevronDown size={15} className={group.collapsed ? "rotated" : ""} />
      </button>
      {canManage && groupIndex > 0 && (
        <button
          type="button"
          className="inline-action-button"
          onClick={() => {
            onMoveGroupOrder?.(group.id, "up");
            setActivePopoverId(null);
          }}
          title="Subir grupo"
          aria-label="Subir grupo"
        >
          <ArrowUp size={15} />
        </button>
      )}
      {canManage && groupIndex < groupCount - 1 && (
        <button
          type="button"
          className="inline-action-button"
          onClick={() => {
            onMoveGroupOrder?.(group.id, "down");
            setActivePopoverId(null);
          }}
          title="Descer grupo"
          aria-label="Descer grupo"
        >
          <ArrowDown size={15} />
        </button>
      )}
      {canManage && (
        <ColorPickerSegment
          color={group.color || activeTab?.color}
          onChange={(color) => onChangeGroupColor?.(group.id, color)}
          title="Alterar cor do grupo"
        />
      )}
      {canManage && (
        <button
          type="button"
          className="inline-action-button"
          onClick={() => {
            onRenameGroup(group.id);
            setActivePopoverId(null);
          }}
          title="Renomear grupo"
          aria-label="Renomear grupo"
        >
          <Edit3 size={15} />
        </button>
      )}
      {canManage && (
        <button
          type="button"
          className="inline-action-button danger"
          onClick={() => {
            onDeleteGroup(group.id);
            setActivePopoverId(null);
          }}
          title="Excluir grupo"
          aria-label="Excluir grupo"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
