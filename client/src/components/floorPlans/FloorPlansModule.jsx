import FloorPlanEditorView from "./editor/FloorPlanEditorView.jsx";
import { useFloorPlanWorkspace } from "./hooks/useFloorPlanWorkspace.js";
import FloorPlansList from "./list/FloorPlansList.jsx";
import "./floorPlanStudio.css";

export { default as InfrastructureModeBar } from "./infrastructure/InfrastructureModeBar.jsx";
export { getInfrastructurePeriodRange } from "./utils/infrastructure.js";

/**
 * Modulo de plantas: lista de plantas e editor 2D/3D. O estado vive nos hooks
 * de `hooks/` (compostos por `useFloorPlanWorkspace`); as telas ficam em
 * `list/` e `editor/`.
 */
export default function FloorPlansModule({ token, devices = [], segments = [], groups = [], activeTab, notify, permissions = {} }) {
  const workspace = useFloorPlanWorkspace({ token, devices, segments, groups, activeTab, notify, permissions });
  const { session } = workspace;

  if (session.view === "list") {
    return (
      <>
        {session.error && <div className="form-error floor-plan-error">{session.error}</div>}
        <FloorPlansList
          plans={session.plans}
          loading={session.plansLoading}
          query={session.listQuery}
          onQueryChange={session.setListQuery}
          onCreate={session.createNewPlan}
          onOpen={session.openPlan}
          onDuplicate={session.duplicatePlan}
          onDelete={session.removePlan}
          permissions={permissions}
        />
      </>
    );
  }

  return (
    <FloorPlanEditorView
      workspace={workspace}
      devices={devices}
      groups={groups}
      segments={segments}
      permissions={permissions}
      activeTab={activeTab}
    />
  );
}
