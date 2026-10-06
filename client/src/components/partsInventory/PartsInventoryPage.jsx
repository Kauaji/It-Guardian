import { useMemo } from "react";
import CategoryModal from "./components/CategoryModal.jsx";
import PartForm from "./components/PartForm.jsx";
import PartInspector from "./components/PartInspector.jsx";
import PartsAlertBanner from "./components/PartsAlertBanner.jsx";
import PartsContent from "./components/PartsContent.jsx";
import PartsHeader from "./components/PartsHeader.jsx";
import PartsSummary from "./components/PartsSummary.jsx";
import PartsToolbar from "./components/PartsToolbar.jsx";
import PartsViewTabs from "./components/PartsViewTabs.jsx";
import { useKitNavigation } from "./hooks/useKitNavigation.js";
import { usePartsActions } from "./hooks/usePartsActions.js";
import { useHardwareReconciliation, usePartsData } from "./hooks/usePartsData.js";
import { usePartsFilters } from "./hooks/usePartsFilters.js";
import { buildComputerKits, groupPartsByFamily } from "./partFamilies.js";
import { installedAssetId, summarizeParts } from "./utils/partsModel.js";
import "./partsInventory.css";

export default function PartsInventoryPage({
  token,
  notify,
  devices = [],
  serviceOrders = [],
  tabs = [],
  groups = [],
  segments = [],
  permissions = {},
  onOpenAsset
}) {
  const filters = usePartsFilters();
  const { search, inventoryState, discrepancyOnly } = filters;
  const { parts, categories, loading, load } = usePartsData({ token, notify, search, inventoryState, discrepancyOnly });
  useHardwareReconciliation({ token, notify, enabled: permissions.reconcileHardware, load });
  const summary = useMemo(() => summarizeParts(parts), [parts]);
  const partFamilies = useMemo(() => groupPartsByFamily(parts), [parts]);
  const computerKits = useMemo(() => buildComputerKits(parts, devices), [devices, parts]);
  const kits = useKitNavigation({ tabs, loading, computerKits });
  const actions = usePartsActions({ token, notify, load });
  const { selected, formPart, categoryModal, saving } = actions;

  function openPart(part) {
    const assetId = installedAssetId(part);
    if (!assetId) return actions.inspect(part);
    actions.setSelected(null);
    filters.setSearch("");
    filters.setDiscrepancyOnly(false);
    filters.setInventoryState("in_use");
    kits.showKit(assetId, devices.find((item) => item.id === assetId)?.tabId);
  }
  function selectView(nextView) {
    kits.setViewMode(nextView);
    kits.resetKits();
    filters.setDiscrepancyOnly(false);
    filters.setInventoryState(nextView === "kits" ? "in_use" : "");
  }
  function reviewDiscrepancies() {
    kits.setViewMode("inventory");
    filters.setInventoryState("in_use");
    filters.setDiscrepancyOnly(true);
  }

  return (
    <section className={`parts-inventory-page ${selected ? "has-inspector" : ""}`}>
      <div className="parts-inventory-main">
        <PartsHeader
          permissions={permissions}
          saving={saving}
          fileInput={actions.fileInput}
          onImportFile={actions.importInvoice}
          onNewPart={() => actions.setFormPart(null)}
        />
        {summary.discrepancies ? <PartsAlertBanner count={summary.discrepancies} onReview={reviewDiscrepancies} /> : null}
        <PartsSummary summary={summary} />
        <PartsViewTabs viewMode={kits.viewMode} onSelectView={selectView} />
        <PartsToolbar
          search={search}
          onSearch={filters.setSearch}
          inventoryState={inventoryState}
          onInventoryState={filters.setInventoryState}
          discrepancyOnly={discrepancyOnly}
          onClearDiscrepancy={() => filters.setDiscrepancyOnly(false)}
          canManageCategories={permissions.manageCategories}
          onOpenCategories={() => actions.setCategoryModal(true)}
        />
        <PartsContent
          loading={loading}
          viewMode={kits.viewMode}
          parts={parts}
          partFamilies={partFamilies}
          computerKits={computerKits}
          onOpenPart={openPart}
          kitProps={{
            tabs,
            groups,
            segments,
            activeTabId: kits.activeKitTabId,
            onSelectTab: kits.selectTab,
            expandedKitId: kits.expandedKitId,
            focusedKitAssetId: kits.focusedKitAssetId,
            focusedKitRef: kits.focusedKit,
            onToggleKit: kits.toggleKit,
            onOpenAsset
          }}
        />
      </div>
      {selected ? (
        <PartInspector
          part={selected}
          devices={devices}
          serviceOrders={serviceOrders}
          permissions={permissions}
          saving={saving}
          onClose={() => actions.setSelected(null)}
          onEdit={() => actions.setFormPart(selected)}
          onMove={actions.movePart}
          onOpenAsset={onOpenAsset}
          onReviewDiscrepancy={actions.reviewDiscrepancy}
        />
      ) : null}
      {formPart !== undefined ? (
        <PartForm
          part={formPart}
          categories={categories}
          saving={saving}
          onClose={() => actions.setFormPart(undefined)}
          onSave={actions.savePart}
        />
      ) : null}
      {categoryModal ? (
        <CategoryModal
          categories={categories}
          saving={saving}
          onClose={() => actions.setCategoryModal(false)}
          onCreate={actions.addCategory}
          onDelete={actions.removeCategory}
        />
      ) : null}
    </section>
  );
}
