import { FloorPlanTopbar } from "../FloorPlanEditorChrome.jsx";

/** Barra superior do editor ligada ao workspace (salvar, historico, modo, ferramentas). */
export default function EditorTopbar({ workspace, activeTab, permissions }) {
  const { session, doc, ui, saveState, persistEditor, paint, placementApi } = workspace;
  const { editor } = doc;

  return (
    <FloorPlanTopbar
      title={`Planta ${activeTab?.name || editor?.plan?.name || "principal"}`}
      onSave={persistEditor}
      saveState={saveState}
      mode={ui.mode}
      onModeChange={(nextMode) => {
        ui.setMode(nextMode);
        if (nextMode !== "2d") ui.setZoomMode(false);
      }}
      canUndo={doc.past.length > 0}
      canRedo={doc.future.length > 0}
      onUndo={doc.undo}
      onRedo={doc.redo}
      selectedTool={ui.selectedTool}
      onToolChange={paint.handleToolChange}
      showGrid={ui.showGrid}
      onToggleGrid={() => ui.setShowGrid((current) => !current)}
      isEditing={session.isEditing}
      onEdit={() => session.setIsEditing(true)}
      canEdit={permissions.update}
      zoomMode={ui.zoomMode}
      onToggleZoom={() => ui.setZoomMode((current) => !current)}
      onDeletePlan={() => session.removePlan(editor.plan)}
      canDelete={Boolean(permissions.delete && editor?.plan)}
      measurementActive={ui.placement?.kind === "measurement"}
      onStartMeasurement={placementApi.startMeasurementTool}
    />
  );
}
