import { Database, Map as MapIcon, Network } from "lucide-react";

export default function BoardViewSwitch({ mode, hasFloorPlans, hasTopology, onChange }) {
  return (
    <div className="inventory-view-switch" role="group" aria-label="Visualização do inventário">
      <button
        type="button"
        className={mode === "board" ? "active" : ""}
        onClick={() => onChange("board")}
        aria-pressed={mode === "board"}
      >
        <Database size={16} aria-hidden="true" />
        Quadro
      </button>
      {hasFloorPlans && (
        <button
          type="button"
          className={mode === "floor-plans" ? "active" : ""}
          onClick={() => onChange("floor-plans")}
          aria-pressed={mode === "floor-plans"}
        >
          <MapIcon size={16} />
          Plantas
        </button>
      )}
      {hasTopology && (
        <button
          type="button"
          className={mode === "topology" ? "active" : ""}
          onClick={() => onChange("topology")}
          aria-pressed={mode === "topology"}
        >
          <Network size={16} />
          Mapa de Rede
        </button>
      )}
    </div>
  );
}
