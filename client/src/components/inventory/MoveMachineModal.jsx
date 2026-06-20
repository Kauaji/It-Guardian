import { X } from "lucide-react";
import { useEffect } from "react";

export default function MoveMachineModal({ machine, segments, targetSegmentId, onTargetChange, onClose, onConfirm }) {
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

  if (!machine) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label="Mover maquina">
        <header>
          <div>
            <h2>Mover maquina</h2>
            <p>{machine.name} - {machine.ip}</p>
          </div>
          <button className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>
        <label>
          Segmento
          <select value={targetSegmentId} onChange={(event) => onTargetChange(event.target.value)}>
            {segments.map((segment) => (
              <option key={segment.id} value={segment.id}>{segment.name}</option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button className="ghost-action" onClick={onClose}>Cancelar</button>
          <button className="primary-action compact-action" onClick={onConfirm}>Mover</button>
        </div>
      </section>
    </div>
  );
}

