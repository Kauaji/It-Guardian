import { useCallback, useState } from "react";
import { MODEL_QUALITY_DETAILED } from "./assets/inventoryMapAssetRegistry.js";
import {
  CAMERA_VIEW_FRONT,
  CAMERA_VIEW_ISOMETRIC,
  CAMERA_VIEW_TOP
} from "./scene3d/constants.js";
import { SceneHelp, SceneStatus, SceneToolbar } from "./scene3d/SceneControls.jsx";
import { useFloorPlanScene } from "./scene3d/useFloorPlanScene.js";
import "./floorPlanStudio.css";

export { getFloorPlanCameraPreset, getFloorPlanContentFrame } from "./scene3d/cameraPresets.js";

const SCENE_KEY_VIEWS = {
  home: CAMERA_VIEW_ISOMETRIC,
  1: CAMERA_VIEW_ISOMETRIC,
  2: CAMERA_VIEW_TOP,
  3: CAMERA_VIEW_FRONT
};

/**
 * Cena 3D do pavimento (three.js), carregada sob demanda no modo 3D. A
 * construcao fica em `scene3d/`; aqui ficam a camera escolhida, os atalhos
 * (1/2/3, F, G) e os controles sobre a cena.
 */
export default function FloorPlanScene3D({
  data,
  activeFloorId,
  selected,
  onSelect,
  onMoveObject,
  preview = false,
  editable = false,
  showGrid = true,
  onGridChange
}) {
  const [cameraView, setCameraView] = useState(CAMERA_VIEW_ISOMETRIC);
  const { containerRef, sceneApiRef, sceneReady, pendingModels } = useFloorPlanScene({
    data,
    activeFloorId,
    preview,
    modelQuality: MODEL_QUALITY_DETAILED,
    cameraView,
    selected,
    editable,
    showGrid,
    onMoveObject,
    onSelect
  });

  const changeCameraView = useCallback((nextView) => {
    setCameraView(nextView);
    sceneApiRef.current?.setCameraView(nextView);
  }, []);

  const fitScene = useCallback(() => {
    sceneApiRef.current?.setCameraView(cameraView);
  }, [cameraView]);

  const toggleGrid = useCallback(() => {
    onGridChange?.(!showGrid);
  }, [onGridChange, showGrid]);

  const handleSceneKeyDown = useCallback((event) => {
    const key = event.key.toLowerCase();
    if (SCENE_KEY_VIEWS[key]) {
      event.preventDefault();
      changeCameraView(SCENE_KEY_VIEWS[key]);
    } else if (key === "f") {
      event.preventDefault();
      fitScene();
    } else if (key === "g") {
      event.preventDefault();
      toggleGrid();
    }
  }, [changeCameraView, fitScene, toggleGrid]);

  const activeFloor = data?.floors?.find((entry) => entry.id === activeFloorId) || data?.floors?.[0];

  return (
    <div
      className={`floor-plan-scene-shell floor-plan-studio-scene ${preview ? "preview" : ""} ${sceneReady ? "is-ready" : "is-loading"}`}
      data-scene-ready={sceneReady && pendingModels === 0 ? "true" : "false"}
    >
      <div
        className="floor-plan-scene-3d"
        ref={containerRef}
        role="region"
        tabIndex={preview ? -1 : 0}
        onKeyDown={handleSceneKeyDown}
        aria-label={`Visualização 3D da planta${activeFloor?.name ? `, ${activeFloor.name}` : ""}. Arraste o fundo para girar, use a roda ou pinça para aproximar e clique em um item para selecionar.`}
      />

      {!preview ? (
        <>
          <SceneStatus floorName={activeFloor?.name} sceneReady={sceneReady} pendingModels={pendingModels} />
          <SceneToolbar
            cameraView={cameraView}
            showGrid={showGrid}
            onChangeView={changeCameraView}
            onToggleGrid={toggleGrid}
            onFit={fitScene}
          />
          <SceneHelp editable={editable} />
        </>
      ) : null}
    </div>
  );
}
