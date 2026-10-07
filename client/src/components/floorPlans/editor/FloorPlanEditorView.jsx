import { useRef } from "react";
import FloorPlanCatalog from "../catalog/FloorPlanCatalog.jsx";
import { useInspectorMaxHeight } from "../hooks/useInspectorMaxHeight.js";
import InfrastructureSummary from "../infrastructure/InfrastructureSummary.jsx";
import PaintToolPanel from "../paint/PaintToolPanel.jsx";
import EditorInfrastructureBar from "./EditorInfrastructureBar.jsx";
import EditorStage from "./EditorStage.jsx";
import EditorTopbar from "./EditorTopbar.jsx";

/** Tela do editor: barra superior, mapa de infraestrutura, palco e catalogo. */
export default function FloorPlanEditorView({ workspace, devices, groups, segments, permissions, activeTab }) {
  const { session, ui, infra, paint } = workspace;
  const isEditing = session.isEditing;
  const stageRef = useRef(null);
  const catalogRef = useRef(null);

  useInspectorMaxHeight({ isEditing, selected: ui.selected, activeCatalog: ui.activeCatalog, stageRef, catalogRef });

  return (
    <section className="floor-plan-editor-shell">
      <EditorTopbar workspace={workspace} activeTab={activeTab} permissions={permissions} />
      <EditorInfrastructureBar workspace={workspace} groups={groups} segments={segments} permissions={permissions} />

      {infra.mode === "dashboard" ? <InfrastructureSummary summary={infra.summary} /> : null}

      <div className={`floor-plan-editor-layout ${isEditing ? "editing" : "view-only"}`}>
        <main className="floor-plan-canvas-panel">
          {isEditing && (
            <PaintToolPanel
              draft={ui.paintDraft}
              groups={groups}
              segments={segments}
              groupAreas={paint.savedGroupAreas}
              onChange={paint.updatePaintDraft}
              onConfirm={paint.confirmPaintArea}
              onCancel={paint.cancelPaintArea}
            />
          )}

          <EditorStage
            workspace={workspace}
            stageRef={stageRef}
            devices={devices}
            groups={groups}
            segments={segments}
            permissions={permissions}
          />

          {isEditing && (
            <FloorPlanCatalog
              activeSection={ui.activeCatalog}
              onActiveSectionChange={ui.setActiveCatalog}
              onAddItem={workspace.placementApi.addCatalogItem}
              onSelectRoomTemplate={workspace.placementApi.beginRoomPlacement}
              placement={ui.placement}
              catalogRef={catalogRef}
            />
          )}
        </main>
      </div>
    </section>
  );
}
