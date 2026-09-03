import {
  Cable,
  Grid3X3,
  MousePointer2,
  Pencil,
  Redo2,
  Ruler,
  Save,
  Search,
  Trash2,
  Undo2,
  Zap
} from "lucide-react";

const SAVE_STATE_LABELS = {
  saved: "Salvo",
  saving: "Salvando",
  dirty: "Alteracoes pendentes",
  error: "Falha ao salvar"
};

export function FloorPlanTopbar({
  title,
  onSave,
  saveState = "saved",
  mode,
  onModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedTool,
  onToolChange,
  showGrid,
  onToggleGrid,
  isEditing,
  onEdit,
  canEdit = true,
  zoomMode = false,
  onToggleZoom,
  onDeletePlan,
  canDelete = false,
  measurementActive = false,
  onStartMeasurement
}) {
  return (
    <header className="floor-plan-editor-topbar">
      <div className="floor-plan-editor-identity">
        <div>
          <strong>{title || "Planta"}</strong>
          <span className={`floor-plan-save-state ${saveState}`} role="status" aria-live="polite">
            <i aria-hidden="true" />
            {SAVE_STATE_LABELS[saveState] || SAVE_STATE_LABELS.saved}
          </span>
        </div>
      </div>

      <div className="floor-plan-editor-actions">
        {isEditing && (
          <>
            <button className="icon-button" type="button" onClick={onUndo} disabled={!canUndo} title="Desfazer" aria-label="Desfazer">
              <Undo2 size={17} />
            </button>
            <button className="icon-button" type="button" onClick={onRedo} disabled={!canRedo} title="Refazer" aria-label="Refazer">
              <Redo2 size={17} />
            </button>
          </>
        )}
        <div className="segmented-control compact floor-plan-mode-switch" aria-label="Modo de visualizacao">
          <button className={mode === "2d" ? "active" : ""} type="button" onClick={() => onModeChange("2d")}>2D</button>
          <button className={mode === "3d" ? "active" : ""} type="button" onClick={() => onModeChange("3d")}>3D</button>
        </div>

        {mode === "2d" ? (
          <button
            className={`icon-button ${zoomMode ? "active" : ""}`}
            type="button"
            onClick={onToggleZoom}
            title={zoomMode ? "Desativar zoom" : "Ativar zoom"}
            aria-pressed={zoomMode}
            aria-label={zoomMode ? "Desativar zoom" : "Ativar zoom"}
          >
            <Search size={17} />
          </button>
        ) : null}

        {isEditing && <div className="floor-plan-top-tools" aria-label="Ferramentas da planta">
          <button className={selectedTool === "select" ? "active" : ""} type="button" onClick={() => onToolChange("select")} title="Selecionar" aria-label="Selecionar" aria-pressed={selectedTool === "select"}>
            <MousePointer2 size={17} />
          </button>
          <button
            className={selectedTool === "delete" ? "active danger-tool" : ""}
            type="button"
            onClick={() => onToolChange(selectedTool === "delete" ? "select" : "delete")}
            title="Excluir itens ao clicar"
            aria-label="Excluir itens ao clicar"
            aria-pressed={selectedTool === "delete"}
          >
            <Trash2 size={17} />
          </button>
          <button className={showGrid ? "active" : ""} type="button" onClick={onToggleGrid} title="Mostrar ou ocultar grade" aria-label="Mostrar ou ocultar grade" aria-pressed={showGrid}>
            <Grid3X3 size={17} />
          </button>
          <button
            className={measurementActive ? "active" : ""}
            type="button"
            onClick={onStartMeasurement}
            title="Medir uma distancia real (desenhar e digitar a metragem)"
            aria-label="Medir uma distancia real"
            aria-pressed={measurementActive}
          >
            <Ruler size={17} />
          </button>
        </div>}

        {isEditing ? (
          <button className="icon-button floor-plan-save-action" type="button" onClick={onSave} title="Salvar planta" aria-label="Salvar planta">
            <Save size={18} />
          </button>
        ) : canEdit ? (
          <button className="icon-button" type="button" onClick={onEdit} title="Editar planta" aria-label="Editar planta">
            <Pencil size={18} />
          </button>
        ) : null}
        {canDelete ? (
          <button
            className="icon-button floor-plan-delete-plan"
            type="button"
            onClick={onDeletePlan}
            title="Excluir planta"
            aria-label="Excluir planta"
          >
            <Trash2 size={18} />
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function FloorPlanQuickActions({ activeSection, onSectionChange }) {
  return (
    <div className="floor-plan-quick-actions" aria-label="Acoes rapidas de infraestrutura">
      <button className={activeSection === "network" ? "active" : ""} type="button" onClick={() => onSectionChange("network")}>
        <Cable size={17} />
        <span>Rede e cabeamento</span>
      </button>
      <button className={activeSection === "energy" ? "active" : ""} type="button" onClick={() => onSectionChange("energy")}>
        <Zap size={17} />
        <span>Energia</span>
      </button>
    </div>
  );
}
