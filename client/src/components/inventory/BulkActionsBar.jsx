import { Printer, Send, X } from "lucide-react";

export default function BulkActionsBar({
  count,
  segments,
  currentTarget,
  onTargetChange,
  onMove,
  onPrint,
  onClear,
  isDragActive = false
}) {
  if (count < 2) return null;

  return (
    <section
      className={`bulk-actions-bar ${isDragActive ? "drag-safe-zone" : ""}`}
      aria-label="Acoes em massa"
    >
      <strong>{count} selecionados</strong>
      <select value={currentTarget} onChange={(event) => onTargetChange(event.target.value)}>
        <option value="">Alterar segmento...</option>
        {segments.map((segment) => (
          <option key={segment.id} value={segment.id}>{segment.name}</option>
        ))}
      </select>
      <button type="button" disabled={!currentTarget} onClick={onMove}>
        <Send size={14} />
        Mover
      </button>
      <button type="button" onClick={onPrint}>
        <Printer size={14} />
        Imprimir QR Codes
      </button>
      <button type="button" className="danger" onClick={onClear}>
        <X size={14} />
        Limpar selecao
      </button>
    </section>
  );
}
