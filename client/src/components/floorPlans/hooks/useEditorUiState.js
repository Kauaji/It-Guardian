import { useCallback, useState } from "react";
import { DEFAULT_FLOOR_PLAN_LAYERS } from "../utils/layers.js";

/**
 * Estado de interface do editor: selecao, ferramenta, catalogo, posicionamento
 * em andamento, modo 2D/3D, grade, camadas, pincel e zoom por clique.
 */
export function useEditorUiState() {
  const [selected, setSelected] = useState(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const [alignmentGuides, setAlignmentGuides] = useState([]);
  const [selectedTool, setSelectedTool] = useState("select");
  const [activeCatalog, setActiveCatalog] = useState("rooms");
  const [placement, setPlacement] = useState(null);
  const [justPlacedObjectId, setJustPlacedObjectId] = useState(null);
  const [mode, setMode] = useState("2d");
  const [showGrid, setShowGrid] = useState(true);
  const [visibleLayers, setVisibleLayers] = useState(DEFAULT_FLOOR_PLAN_LAYERS);
  const [paintDraft, setPaintDraft] = useState(null);
  const [zoomMode, setZoomMode] = useState(false);

  const toggleVisibleLayer = useCallback((layerId) => {
    setVisibleLayers((current) => ({ ...current, [layerId]: !current[layerId] }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setSelectedObjectIds([]);
  }, []);

  return {
    selected, setSelected,
    selectedObjectIds, setSelectedObjectIds,
    selectionBox, setSelectionBox,
    alignmentGuides, setAlignmentGuides,
    selectedTool, setSelectedTool,
    activeCatalog, setActiveCatalog,
    placement, setPlacement,
    justPlacedObjectId, setJustPlacedObjectId,
    mode, setMode,
    showGrid, setShowGrid,
    visibleLayers, toggleVisibleLayer,
    paintDraft, setPaintDraft,
    zoomMode, setZoomMode,
    clearSelection
  };
}
