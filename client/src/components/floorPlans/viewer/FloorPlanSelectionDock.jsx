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
    <div className="floor-plan-selection-dock" role="toolbar" aria-label="Acoes da selecao">
      <span>{count === 1 ? "1 item" : `${count} itens`}</span>
      <button
        type="button"
        onClick={onDuplicate}
        disabled={!canDuplicate}
        title={canDuplicate ? "Duplicar selecao" : "Este item nao pode ser duplicado"}
        aria-label="Duplicar selecao"
      >
        <Copy size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onRotate} disabled={!canRotate} title="Girar 90 graus" aria-label="Girar selecao 90 graus">
        <RotateCw size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onToggleLock}
        disabled={!canLock}
        className={locked ? "active" : ""}
        title={locked ? "Destravar objeto" : "Travar objeto"}
        aria-label={locked ? "Destravar selecao" : "Travar selecao"}
        aria-pressed={locked}
      >
        {locked ? <Unlock size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
      </button>
      <button className="danger" type="button" onClick={onDelete} disabled={!canDelete} title="Excluir selecao" aria-label="Excluir selecao">
        <Trash2 size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onClear} title="Limpar selecao" aria-label="Limpar selecao">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
