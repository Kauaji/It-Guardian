import { Focus, MousePointer2, RotateCcw } from "lucide-react";

export default function VisualMapCameraActions({ hasSelection, onAction }) {
  return (
    <div className="inventory-visual-camera-actions" role="group" aria-label="Controles da câmera">
      <button type="button" className="icon-button" onClick={() => onAction("fit")} title="Enquadrar mapa">
        <Focus size={16} />
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => onAction("selection")}
        disabled={!hasSelection}
        title="Centralizar objeto"
      >
        <MousePointer2 size={16} />
      </button>
      <button type="button" className="icon-button" onClick={() => onAction("reset")} title="Redefinir câmera">
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
