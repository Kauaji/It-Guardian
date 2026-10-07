import { Copy, Lock, RotateCw, Trash2, Unlock, X } from "lucide-react";

export default function FloorPlanSelectionDock({
  count,
  canDuplicate,
  canRotate,
  canDelete,
  canLock,
  locked,
  onDuplicate,
  onRotate,
  onDelete,
  onToggleLock,
  onClear
}) {
  return (
    <div className="floor-plan-selection-dock" role="toolbar" aria-label="Ações da seleção">
      <span>{count === 1 ? "1 item" : `${count} itens`}</span>
      <button
        type="button"
        onClick={onDuplicate}
        disabled={!canDuplicate}
        title={canDuplicate ? "Duplicar seleção" : "Este item não pode ser duplicado"}
        aria-label="Duplicar seleção"
      >
        <Copy size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onRotate} disabled={!canRotate} title="Girar 90 graus" aria-label="Girar seleção 90 graus">
        <RotateCw size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onToggleLock}
        disabled={!canLock}
        className={locked ? "active" : ""}
        title={locked ? "Destravar objeto" : "Travar objeto"}
        aria-label={locked ? "Destravar seleção" : "Travar seleção"}
        aria-pressed={locked}
      >
        {locked ? <Unlock size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
      </button>
      <button
        className="danger"
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        title="Excluir seleção"
        aria-label="Excluir seleção"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onClear} title="Limpar seleção" aria-label="Limpar seleção">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
