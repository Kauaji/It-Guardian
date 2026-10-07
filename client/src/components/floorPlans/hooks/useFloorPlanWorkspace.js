import { useCanvasInteractions } from "./useCanvasInteractions.js";
import { useCanvasViewport } from "./useCanvasViewport.js";
import { useEditorShortcuts } from "./useEditorShortcuts.js";
import { useEditorUiState } from "./useEditorUiState.js";
import { useEntityActions } from "./useEntityActions.js";
import { useFloorBackground } from "./useFloorBackground.js";
import { useFloorPlanEditor } from "./useFloorPlanEditor.js";
import { useFloorPlanPersistence, useSaveTracker } from "./useFloorPlanPersistence.js";
import { useFloorPlanSession } from "./useFloorPlanSession.js";
import { useInfrastructureView } from "./useInfrastructureView.js";
import { useInventoryLink } from "./useInventoryLink.js";
import { usePaintTool } from "./usePaintTool.js";
import { usePlacement } from "./usePlacement.js";
import { useSelectionTransforms } from "./useSelectionTransforms.js";

/**
 * Compoe os hooks do modulo de plantas. Cada grupo retornado tem uma
 * responsabilidade: `session` (lista/navegacao), `doc` (planta e historico),
 * `ui` (estado de interface), `viewport` (zoom/pan), `entities`/`transforms`
 * (acoes da selecao), `paint`, `placementApi`, `pointer` (eventos do canvas),
 * `infra` (mapa de infraestrutura), `background` e `linkObject`.
 */
export function useFloorPlanWorkspace({ token, devices, segments, groups, activeTab, notify, permissions }) {
  const ui = useEditorUiState();
  const tracker = useSaveTracker();
  const doc = useFloorPlanEditor({ markDirty: tracker.markDirty });
  const session = useFloorPlanSession({ token, activeTab, permissions, notify, doc, ui, tracker });
  const { persistEditor } = useFloorPlanPersistence({
    token,
    permissions,
    notify,
    doc,
    tracker,
    onSaved: session.applySavedPlan,
    onError: session.setError
  });
  const infra = useInfrastructureView({ token, permissions, notify, planId: doc.editor?.plan?.id, segments, ui });
  const background = useFloorBackground({ token, notify, doc });
  const viewport = useCanvasViewport({ doc, ui });
  const paint = usePaintTool({ doc, ui, groups, segments, notify });
  const entities = useEntityActions({ doc, ui, notify });
  const transforms = useSelectionTransforms({ doc, ui, notify });
  const placementApi = usePlacement({ doc, ui, notify, viewport, paint });
  const pointer = useCanvasInteractions({ doc, ui, viewport, paint, placementApi, entities, isEditing: session.isEditing });
  useEditorShortcuts({ view: session.view, doc, ui, viewport, paint, placementApi, entities, transforms });
  const { linkObject } = useInventoryLink({ token, devices, permissions, notify, entities });

  return {
    session,
    doc,
    saveState: tracker.saveState,
    persistEditor,
    ui,
    viewport,
    paint,
    entities,
    transforms,
    placementApi,
    pointer,
    infra,
    background,
    linkObject
  };
}
