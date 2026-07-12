import { Eye, EyeOff } from "lucide-react";
import {
  QUICK_LAYER_VIEWS,
  VISUAL_MAP_LAYER_OPTIONS,
  getQuickLayerState
} from "./inventoryVisualMapConnectionUtils.js";

export default function InventoryVisualMapLayerPresetBar({ layers, onLayersChange, onToggleLayer }) {
  return (
    <div className="inventory-visual-layer-controls">
      <div className="inventory-visual-quick-views" role="group" aria-label="Visualizacoes rapidas do mapa">
        {QUICK_LAYER_VIEWS.map((view) => (
          <button
            key={view.key}
            type="button"
            onClick={() => onLayersChange(getQuickLayerState(view.key))}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div className="inventory-visual-layer-list" role="group" aria-label="Camadas do mapa">
        {VISUAL_MAP_LAYER_OPTIONS.map((option) => {
          const active = layers?.[option.key] !== false;
          return (
            <button
              key={option.key}
              type="button"
              className={`inventory-visual-layer-toggle ${active ? "active" : ""}`}
              onClick={() => onToggleLayer(option.key)}
            >
              {active ? <Eye size={16} /> : <EyeOff size={16} />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
