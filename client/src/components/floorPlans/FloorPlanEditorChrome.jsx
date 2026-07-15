import {
  Cable,
  Check,
  Eraser,
  Grid3X3,
  Hand,
  Layers3,
  Lightbulb,
  Loader2,
  Maximize2,
  Menu,
  Monitor,
  MoreVertical,
  MousePointer2,
  Paintbrush,
  Redo2,
  Ruler,
  Save,
  Share2,
  Undo2,
  Zap
} from "lucide-react";

export function FloorPlanTopbar({
  editor,
  activeFloorId,
  onFloorChange,
  onBack,
  onSave,
  saveState,
  mode,
  onModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedTool,
  onToolChange,
  onActivateWall,
  onActivateEraser,
  showGrid,
  onToggleGrid
}) {
  const floors = editor?.floors || [];

  return (
    <header className="floor-plan-editor-topbar">
      <div className="floor-plan-editor-identity">
        <button className="icon-button floor-plan-menu-button" type="button" onClick={onBack} title="Voltar para plantas">
          <Menu size={19} />
        </button>
        <div>
          <strong>{editor?.plan?.name || "Planta"}</strong>
          <label className="floor-plan-floor-selector">
            <span>Planta</span>
            <select value={activeFloorId} onChange={(event) => onFloorChange(event.target.value)} aria-label="Trocar andar da planta">
              {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="floor-plan-editor-center-actions">
        <button className="icon-button" type="button" onClick={onUndo} disabled={!canUndo} title="Desfazer">
          <Undo2 size={17} />
        </button>
        <button className="icon-button" type="button" onClick={onRedo} disabled={!canRedo} title="Refazer">
          <Redo2 size={17} />
        </button>
        <span className={`floor-plan-save-state ${saveState}`}>
          {saveState === "saving" ? <Loader2 size={15} /> : <Check size={15} />}
          {saveState === "dirty" ? "Alteracoes nao salvas" : saveState === "saving" ? "Salvando..." : saveState === "error" ? "Erro ao salvar" : "Salvo"}
        </span>
      </div>

      <div className="floor-plan-editor-actions">
        <div className="segmented-control compact floor-plan-mode-switch" aria-label="Modo de visualizacao">
          <button className={mode === "2d" ? "active" : ""} type="button" onClick={() => onModeChange("2d")}>2D</button>
          <button className={mode === "3d" ? "active" : ""} type="button" onClick={() => onModeChange("3d")}>3D</button>
        </div>

        <div className="floor-plan-top-tools" aria-label="Ferramentas da planta">
          <button className={selectedTool === "pan" ? "active" : ""} type="button" onClick={() => onToolChange("pan")} title="Mover tela">
            <Hand size={17} />
          </button>
          <button className={selectedTool === "select" ? "active" : ""} type="button" onClick={() => onToolChange("select")} title="Selecionar">
            <MousePointer2 size={17} />
          </button>
          <button type="button" onClick={onActivateWall} title="Desenhar parede">
            <Ruler size={17} />
          </button>
          <button type="button" onClick={onActivateEraser} title="Borracha da demarcacao">
            <Eraser size={17} />
          </button>
          <button className={showGrid ? "active" : ""} type="button" onClick={onToggleGrid} title="Mostrar ou ocultar grade">
            <Grid3X3 size={17} />
          </button>
        </div>

        <button className="secondary-action compact-action floor-plan-share-action" type="button" disabled title="Compartilhamento em desenvolvimento">
          <Share2 size={16} />
          Compartilhar
        </button>
        <button className="icon-button" type="button" disabled title="Mais opcoes em desenvolvimento">
          <MoreVertical size={18} />
        </button>
        <button className="secondary-action compact-action floor-plan-save-action" type="button" onClick={onSave}>
          <Save size={16} />
          Salvar
        </button>
      </div>
    </header>
  );
}

export function FloorPlanBrushPanel({ selectedTool, onToolChange, hasGroupArea, selectedGroupName }) {
  return (
    <aside className="floor-plan-brush-panel" aria-label="Pinceis de infraestrutura">
      <header>
        <strong>Pinceis de infraestrutura</strong>
        <span title="As demarcacoes ficam sobre o piso e nao alteram objetos">i</span>
      </header>

      <button
        className={`floor-plan-brush-card group ${selectedTool === "group-brush" ? "active" : ""}`}
        type="button"
        onClick={() => onToolChange("group-brush")}
      >
        <span className="floor-plan-brush-icon"><Paintbrush size={20} /></span>
        <span className="floor-plan-brush-copy">
          <strong>1 Pincel de Grupo</strong>
          <small>Defina areas principais da sua infraestrutura.</small>
          <small>Clique e arraste no piso para criar um grupo.</small>
        </span>
        <span className="floor-plan-brush-status">
          <i />
          {selectedGroupName || "Grupo selecionado"}
        </span>
      </button>

      <button
        className={`floor-plan-brush-card segment ${selectedTool === "segment-brush" ? "active" : ""}`}
        type="button"
        onClick={() => onToolChange("segment-brush")}
        disabled={!hasGroupArea}
      >
        <span className="floor-plan-brush-icon"><Monitor size={20} /></span>
        <span className="floor-plan-brush-copy">
          <strong>2 Pincel de Segmento</strong>
          <small>Divida o grupo atual em segmentos logicos.</small>
        </span>
        <span className="floor-plan-brush-lock">
          {hasGroupArea ? "Selecione a area de grupo" : "Selecione um grupo para liberar os segmentos."}
        </span>
      </button>

      <div className="floor-plan-brush-tip">
        <Lightbulb size={18} />
        <span>Comece pelo Pincel de Grupo, depois crie os Segmentos dentro do grupo selecionado.</span>
      </div>
    </aside>
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

export function FloorPlanPreviewCard({ mode, onModeChange, onExpand, children }) {
  return (
    <section className="floor-plan-preview-card" aria-label="Visualizacao 3D em miniatura">
      <header>
        <strong>Visualizacao 3D (preview)</strong>
        <div className="segmented-control compact">
          <button className={mode === "2d" ? "active" : ""} type="button" onClick={() => onModeChange("2d")}>2D</button>
          <button className={mode === "3d" ? "active" : ""} type="button" onClick={() => onModeChange("3d")}>3D</button>
        </div>
      </header>
      <div className="floor-plan-preview-viewport">{children}</div>
      <footer>
        <button className="icon-button" type="button" title="Vista do modelo"><Layers3 size={16} /></button>
        <button className="icon-button" type="button" title="Camadas"><Grid3X3 size={16} /></button>
        <button className="icon-button" type="button" onClick={onExpand} title="Expandir visualizacao 3D"><Maximize2 size={16} /></button>
      </footer>
    </section>
  );
}
