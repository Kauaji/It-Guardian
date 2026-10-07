import { useAppSession } from "../../context/AppSessionContext.jsx";
import GeneralSettingsModal from "../../components/settings/GeneralSettingsModal.jsx";
import InventoryTabFormModal from "../../components/inventory/InventoryTabFormModal.jsx";
import ManualAssetForm from "../../components/inventory/ManualAssetForm.jsx";
import SegmentFormModal from "../../components/inventory/SegmentFormModal.jsx";
import SegmentGroupFormModal from "../../components/inventory/SegmentGroupFormModal.jsx";
import { pickUnusedPaletteColor } from "../../components/inventory/inventoryLocalState.js";
import { useInventory, useInventoryActions, useNavigation, useWorkspaceData } from "../context/workspaceContexts.js";
import { useSystemModeChange } from "../hooks/useSystemModeChange.js";

// Modais globais do app (formularios do inventario e configuracoes gerais).
// Nenhum deles tem rota: o estado de abertura vive nos hooks de dominio.
export default function AppModals({ generalSettingsOpen, onCloseGeneralSettings }) {
  const { token, user, theme, toggleTheme, notify } = useAppSession();
  const { systemMode } = useWorkspaceData();
  const { model } = useInventory();
  const { assets, groups, segments, tabs } = useInventoryActions();
  const { logout } = useNavigation();
  const changeSystemMode = useSystemModeChange();

  return (
    <>
      <SegmentFormModal
        mode={segments.segmentForm?.mode}
        segment={segments.segmentForm?.segment}
        segments={model.activeSegments}
        groups={model.activeSegmentGroups}
        selectedGroupId={segments.segmentForm?.groupId || ""}
        saving={segments.segmentSaving}
        onClose={segments.closeSegmentForm}
        onSubmit={segments.submitSegmentForm}
      />
      <SegmentGroupFormModal
        mode={groups.segmentGroupForm?.mode}
        group={groups.segmentGroupForm?.group}
        groups={model.activeSegmentGroups}
        suggestedColor={pickUnusedPaletteColor(model.activeSegmentGroups)}
        saving={groups.segmentGroupSaving}
        onClose={groups.closeSegmentGroupForm}
        onSubmit={groups.submitSegmentGroupForm}
      />
      <InventoryTabFormModal
        tab={tabs.inventoryTabForm}
        tabs={model.inventoryTabs}
        onClose={tabs.closeInventoryTabForm}
        onSubmit={tabs.submitInventoryTabForm}
      />
      <ManualAssetForm
        open={assets.manualAssetFormOpen}
        saving={assets.manualAssetSaving}
        onClose={assets.closeManualAssetForm}
        onSubmit={assets.handleCreateManualAsset}
      />
      <GeneralSettingsModal
        open={generalSettingsOpen}
        token={token}
        user={user}
        theme={theme}
        systemMode={systemMode}
        onClose={onCloseGeneralSettings}
        onSystemModeChange={changeSystemMode}
        onToggleTheme={toggleTheme}
        onLogout={logout}
        notify={notify}
      />
    </>
  );
}
