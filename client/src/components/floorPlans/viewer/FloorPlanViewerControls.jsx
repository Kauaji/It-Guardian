import { Layers3, Maximize2, Minus, Plus } from "lucide-react";
import { FLOOR_PLAN_LAYER_OPTIONS } from "../utils/layers.js";

function LayerMenu({ visibleLayers, onToggleLayer }) {
  return (
    <details className="floor-plan-layer-menu">
      <summary title="Camadas" aria-label="Camadas">
        <Layers3 size={16} />
      </summary>
      <div>
        {FLOOR_PLAN_LAYER_OPTIONS.map((option) => (
          <label key={option.id}>
            <input type="checkbox" checked={Boolean(visibleLayers[option.id])} onChange={() => onToggleLayer(option.id)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

export default function FloorPlanViewerControls({ mode, visibleLayers, zoomPercent, onToggleLayer, onFit, onReset, onZoomIn, onZoomOut }) {
  if (mode !== "2d") return null;

  return (
    <div className="floor-plan-viewer-controls" aria-label="Controles de visualização 2D">
      <button type="button" onClick={onZoomOut} title="Diminuir zoom" aria-label="Diminuir zoom">
        <Minus size={16} aria-hidden="true" />
      </button>
      <button
        className="floor-plan-zoom-value"
        type="button"
        onClick={onReset}
        title="Restaurar zoom"
        aria-label={`Restaurar zoom. Zoom atual ${zoomPercent}%`}
      >
        {zoomPercent}%
      </button>
      <button type="button" onClick={onZoomIn} title="Aumentar zoom" aria-label="Aumentar zoom">
        <Plus size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onFit} title="Enquadrar planta" aria-label="Enquadrar planta">
        <Maximize2 size={16} aria-hidden="true" />
      </button>
      <LayerMenu visibleLayers={visibleLayers} onToggleLayer={onToggleLayer} />
    </div>
  );
}
