import { Plus, RefreshCw } from "lucide-react";

export default function VisualMapHeader({ title, hasUnsavedChanges, loading, saving, canManage, onRefresh, onCreateMap }) {
  return (
    <header className="inventory-visual-map-header">
      <div>
        <span>Mapa visual 3D</span>
        <strong>{title}</strong>
        {hasUnsavedChanges && <em className="inventory-visual-unsaved-badge">Alterações não salvas</em>}
      </div>
      <div className="inventory-visual-map-actions">
        <button type="button" className="icon-button" onClick={onRefresh} disabled={loading} title="Atualizar mapas">
          <RefreshCw size={18} />
        </button>
        {canManage && (
          <button type="button" className="primary-action compact-action" onClick={onCreateMap} disabled={saving}>
            <Plus size={16} />
            Novo mapa
          </button>
        )}
      </div>
    </header>
  );
}
