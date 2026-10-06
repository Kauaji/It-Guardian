import { Boxes, Layers3 } from "lucide-react";

export default function PartsViewTabs({ viewMode, onSelectView }) {
  return (
    <div className="parts-view-tabs" aria-label="Visualização do inventário">
      <button type="button" className={viewMode === "inventory" ? "active" : ""} onClick={() => onSelectView("inventory")}>
        <Boxes size={16} /> Peças por tipo
      </button>
      <button type="button" className={viewMode === "kits" ? "active" : ""} onClick={() => onSelectView("kits")}>
        <Layers3 size={16} /> Kits por computador
      </button>
    </div>
  );
}
