import { Map, Plus } from "lucide-react";

export default function VisualMapEmptyState({ canManage, saving, onCreateMap }) {
  return (
    <div className="inventory-visual-map-empty">
      <Map size={28} />
      <strong>Nenhum mapa visual cadastrado.</strong>
      <span>Crie um mapa para posicionar salas, racks, mesas e ativos reais do inventário.</span>
      {canManage && (
        <button type="button" className="primary-action compact-action" onClick={onCreateMap} disabled={saving}>
          <Plus size={16} />
          Criar primeiro mapa
        </button>
      )}
    </div>
  );
}
