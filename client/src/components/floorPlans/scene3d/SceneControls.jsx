import { Box, Grid3X3, House, Maximize2, Move3D, Orbit, Sparkles } from "lucide-react";
import { CAMERA_VIEW_FRONT, CAMERA_VIEW_ISOMETRIC, CAMERA_VIEW_TOP } from "./constants.js";

const VIEW_OPTIONS = [
  { view: CAMERA_VIEW_ISOMETRIC, label: "Perspectiva", title: "Vista isométrica", Icon: Box },
  { view: CAMERA_VIEW_TOP, label: "Superior", title: "Vista superior", Icon: Move3D },
  { view: CAMERA_VIEW_FRONT, label: "Frontal", title: "Vista frontal", Icon: House }
];

/** Estado da cena: pavimento e andamento do refinamento dos modelos 3D. */
export function SceneStatus({ floorName, sceneReady, pendingModels }) {
  const sceneStatus = !sceneReady
    ? "Preparando ambiente"
    : pendingModels > 0
      ? `Refinando ${pendingModels} ${pendingModels === 1 ? "modelo" : "modelos"}`
      : "Cena pronta";
  return (
    <div className="floor-plan-scene-status" role="status" aria-live="polite">
      <span className="floor-plan-scene-status-icon" aria-hidden="true">
        {pendingModels > 0 || !sceneReady ? <Sparkles size={15} /> : <Box size={15} />}
      </span>
      <span>
        <strong>{floorName || "Ambiente 3D"}</strong>
        <small>{sceneStatus}</small>
      </span>
    </div>
  );
}

/** Vistas da camera, grade e enquadramento. */
export function SceneToolbar({ cameraView, showGrid, onChangeView, onToggleGrid, onFit }) {
  return (
    <div className="floor-plan-scene-toolbar" role="toolbar" aria-label="Vistas e controles 3D">
      <div className="floor-plan-scene-view-switch" role="group" aria-label="Escolher vista">
        {VIEW_OPTIONS.map(({ view, label, title, Icon }) => (
          <button
            key={view}
            type="button"
            className={cameraView === view ? "active" : ""}
            onClick={() => onChangeView(view)}
            aria-pressed={cameraView === view}
            title={title}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <span className="floor-plan-scene-toolbar-divider" aria-hidden="true" />
      <button type="button" onClick={onToggleGrid} aria-pressed={showGrid} title={showGrid ? "Ocultar grade" : "Mostrar grade"}>
        <Grid3X3 size={17} aria-hidden="true" />
        <span>Grade</span>
      </button>
      <button type="button" onClick={onFit} title="Enquadrar planta">
        <Maximize2 size={17} aria-hidden="true" />
        <span>Enquadrar</span>
      </button>
    </div>
  );
}

export function SceneHelp({ editable }) {
  return (
    <div className="floor-plan-scene-help" aria-hidden="true">
      <Orbit size={16} />
      <span><strong>Arraste</strong> para orbitar</span>
      <i />
      <span><strong>Roda ou pinça</strong> para aproximar</span>
      {editable ? <><i /><span><strong>Arraste um item</strong> para mover</span></> : null}
    </div>
  );
}
