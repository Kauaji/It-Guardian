import {
  Cable,
  Grid3X3,
  Layers3,
  Monitor,
  MousePointer2,
  Paintbrush,
  Pencil,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Zap
} from "lucide-react";

export function FloorPlanTopbar({
  title,
  onSave,
  mode,
  onModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedTool,
  onToolChange,
  hasGroupArea = false,
  showGrid,
  onToggleGrid,
  isEditing,
  onEdit,
  canEdit = true
}) {
  return (
    <header className="floor-plan-editor-topbar">
      <div className="floor-plan-editor-identity">
        <strong>{title || "Planta"}</strong>
      </div>

      <div className="floor-plan-editor-actions">
        {isEditing && (
          <>
            <button className="icon-button" type="button" onClick={onUndo} disabled={!canUndo} title="Desfazer">
              <Undo2 size={17} />
            </button>
            <button className="icon-button" type="button" onClick={onRedo} disabled={!canRedo} title="Refazer">
              <Redo2 size={17} />
            </button>
          </>
        )}
        <div className="segmented-control compact floor-plan-mode-switch" aria-label="Modo de visualizacao">
          <button className={mode === "2d" ? "active" : ""} type="button" onClick={() => onModeChange("2d")}>2D</button>
          <button className={mode === "3d" ? "active" : ""} type="button" onClick={() => onModeChange("3d")}>3D</button>
        </div>

        {isEditing && <div className="floor-plan-top-tools" aria-label="Ferramentas da planta">
          <button className={selectedTool === "select" ? "active" : ""} type="button" onClick={() => onToolChange("select")} title="Selecionar">
            <MousePointer2 size={17} />
          </button>
          <button
            className={`floor-plan-expandable-tool ${selectedTool === "group-brush" ? "active expanded" : ""}`}
            type="button"
            onClick={() => onToolChange(selectedTool === "group-brush" ? "select" : "group-brush")}
            title="Pincel de grupo"
          >
            <Paintbrush size={17} />
            <span>Pincel de grupo</span>
          </button>
          <button
            className={`floor-plan-expandable-tool ${selectedTool === "segment-brush" ? "active expanded" : ""}`}
            type="button"
            onClick={() => onToolChange(selectedTool === "segment-brush" ? "select" : "segment-brush")}
            title={hasGroupArea ? "Pincel de segmento" : "Crie uma area de grupo antes de demarcar segmentos"}
            disabled={!hasGroupArea}
          >
            <Monitor size={17} />
            <span>Pincel de segmento</span>
          </button>
          <button
            className={selectedTool === "delete" ? "active danger-tool" : ""}
            type="button"
            onClick={() => onToolChange(selectedTool === "delete" ? "select" : "delete")}
            title="Excluir itens ao clicar"
          >
            <Trash2 size={17} />
          </button>
          <button className={showGrid ? "active" : ""} type="button" onClick={onToggleGrid} title="Mostrar ou ocultar grade">
            <Grid3X3 size={17} />
          </button>
        </div>}

        {isEditing ? (
          <button className="icon-button floor-plan-save-action" type="button" onClick={onSave} title="Salvar planta">
            <Save size={18} />
          </button>
        ) : canEdit ? (
          <button className="icon-button" type="button" onClick={onEdit} title="Editar planta">
            <Pencil size={18} />
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
        <span>Passagem de cabos</span>
      </button>
      <button className={activeSection === "network" ? "active" : ""} type="button" onClick={() => onSectionChange("network")}>
        <Layers3 size={17} />
        <span>Pontos de rede</span>
      </button>
      <button className={activeSection === "energy" ? "active" : ""} type="button" onClick={() => onSectionChange("energy")}>
        <Zap size={17} />
        <span>Energia</span>
      </button>
    </div>
  );
}
