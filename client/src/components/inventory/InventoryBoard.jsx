import { useEffect, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ArrowDown, ArrowUp, Box, ChevronDown, Database, Edit3, ListFilter, Map as MapIcon, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import SegmentCard from "./SegmentCard.jsx";
import MoveMachineModal from "./MoveMachineModal.jsx";
import MachineDetailsModal from "./MachineDetailsModal.jsx";
import BulkActionsBar from "./BulkActionsBar.jsx";
import InventoryTabs from "./InventoryTabs.jsx";
import ColorPickerSegment from "./ColorPickerSegment.jsx";

function SegmentGroupContainer({ groupId, color, className = "", children }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `group-drop-${groupId || "ungrouped"}`,
    data: { type: "segment-group-drop", groupId }
  });

  return (
    <section
      ref={setNodeRef}
      className={`segment-group-section ${className} ${isOver ? "group-drop-over" : ""}`}
      style={{ "--group-color": color || "#8b9bb0" }}
    >
      {children}
    </section>
  );
}

export default function InventoryBoard({
  devices: _devices = [],
  segments,
  machinesBySegment,
  token: _token,
  notify: _notify,
  search,
  setSearch,
  selectedGroupId = "all",
  selectedSegmentId,
  selectedAssetIds = new Set(),
  isBulkSelectionDragging = false,
  bulkMoveTarget,
  aliases = {},
  observations = {},
  userName,
  canManage,
  moveModal,
  moveTarget,
  setMoveTarget,
  onCreateSegment,
  onRenameSegment,
  onDeleteSegment,
  onChangeSegmentColor,
  onAliasSave,
  onAddObservation,
  onMoveMachine,
  onBulkMoveTargetChange,
  onBulkMove,
  onBulkPrint,
  onBulkMarkBackup,
  onClearSelection,
  onSelectAsset,
  onToggleSelection,
  groups = [],
  onSelectGroup,
  onSelectSegment,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onChangeGroupColor,
  onToggleGroup,
  onMoveGroupOrder,
  onMoveSegmentToGroup,
  onMoveSegmentOrder,
  tabs = [],
  activeTab,
  activeTabId,
  onSelectTab,
  onCreateTab,
  onRenameTab,
  onDeleteTab,
  onChangeTabColor,
  onRemovePeripheral,
  onCreateManualAsset,
  onRefreshPing,
  onChangeDeviceType,
  onPutMaintenance,
  onToggleBackup,
  onRemoveMachine,
  onCloseMoveModal,
  onOpenMoveModal,
  floorPlansView = null,
  visualMapView = null
}) {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [activePopoverId, setActivePopoverId] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inventoryViewMode, setInventoryViewMode] = useState("board");
  const [selectedSegmentIds, setSelectedSegmentIds] = useState(new Set());
  const maintenanceSegment = segments.find((segment) => /manuten/i.test(segment.name || ""));
  const backupSegment = segments.find((segment) => segment.isBackupSegment || /backup/i.test(segment.name || ""));
  const segmentGroupIdMap = useMemo(() => {
    const next = new Map();

    for (const group of groups) {
      for (const segmentId of group.segmentIds || []) {
        next.set(segmentId, group.id);
      }
    }

    for (const segment of segments) {
      if (segment.groupId) next.set(segment.id, segment.groupId);
    }

    return next;
  }, [groups, segments]);
  const visibleSegments = useMemo(() => segments.filter((segment) => {
    if (search.trim()) return (machinesBySegment.get(segment.id) || []).length > 0;
    if (selectedSegmentId !== "all") return segment.id === selectedSegmentId;

    const groupId = segmentGroupIdMap.get(segment.id) || "";
    if (selectedGroupId === "ungrouped") return !groupId;
    if (selectedGroupId !== "all") return groupId === selectedGroupId;
    return true;
  }), [machinesBySegment, search, segmentGroupIdMap, segments, selectedGroupId, selectedSegmentId]);
  const groupedSections = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          segments: visibleSegments.filter((segment) => (segmentGroupIdMap.get(segment.id) || "") === group.id)
        }))
        .filter((group) => {
          if (selectedGroupId !== "all" && selectedGroupId !== group.id) return false;
          if (search.trim() && !group.segments.length) return false;
          return selectedSegmentId === "all" || group.segments.length;
        }),
    [groups, search, segmentGroupIdMap, selectedGroupId, selectedSegmentId, visibleSegments]
  );
  const ungroupedSegments = useMemo(
    () => visibleSegments.filter((segment) => !(segmentGroupIdMap.get(segment.id) || "")),
    [segmentGroupIdMap, visibleSegments]
  );
  const defaultUngroupedSegments = useMemo(
    () =>
      segments.filter((segment) => {
        if (!segment.isDefault) return false;
        if (search.trim() && !(machinesBySegment.get(segment.id) || []).length) return false;
        if (selectedSegmentId !== "all") return selectedSegmentId === segment.id;
        return selectedGroupId === "all" || selectedGroupId === "ungrouped";
      }),
    [machinesBySegment, search, segments, selectedGroupId, selectedSegmentId]
  );
  const regularUngroupedSegments = useMemo(
    () => ungroupedSegments.filter((segment) => !segment.isDefault),
    [ungroupedSegments]
  );
  const showUngroupedSection =
    regularUngroupedSegments.length > 0 &&
    (selectedGroupId === "all" || selectedGroupId === "ungrouped" || selectedSegmentId !== "all");

  async function handleSelectedTypeChange(assetType) {
    if (!selectedMachine) return;
    const updated = await onChangeDeviceType(selectedMachine.id, assetType);
    if (updated) setSelectedMachine(updated);
  }

  async function handleSelectedPingRefresh() {
    if (!selectedMachine) return;
    const updated = await onRefreshPing(selectedMachine);
    if (updated) setSelectedMachine(updated);
  }

  useEffect(() => {
    if (!activePopoverId) return undefined;

    function closeActivePopover(event) {
      if (!event.key || event.key === "Escape") {
        setActivePopoverId(null);
      }
    }

    document.addEventListener("click", closeActivePopover);
    document.addEventListener("keydown", closeActivePopover);
    return () => {
      document.removeEventListener("click", closeActivePopover);
      document.removeEventListener("keydown", closeActivePopover);
    };
  }, [activePopoverId]);

  useEffect(() => {
    function closeActivePopover() {
      setActivePopoverId(null);
    }

    window.addEventListener("it-guardian:close-popovers", closeActivePopover);
    return () => window.removeEventListener("it-guardian:close-popovers", closeActivePopover);
  }, []);

  useEffect(() => {
    setActivePopoverId(null);
    setSelectedSegmentIds(new Set());
  }, [activeTabId, selectedGroupId, selectedSegmentId]);

  useEffect(() => {
    setActivePopoverId(null);
  }, [inventoryViewMode]);

  useEffect(() => {
    if (inventoryViewMode === "floor-plans" && !floorPlansView) {
      setInventoryViewMode("board");
    }
    if (inventoryViewMode === "visual-map" && !visualMapView) {
      setInventoryViewMode("board");
    }
  }, [floorPlansView, inventoryViewMode, visualMapView]);

  useEffect(() => {
    if (!selectedMachine) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    document.body.classList.add("machine-details-open");
    setActivePopoverId(null);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.body.classList.remove("machine-details-open");
    };
  }, [selectedMachine]);

  function handleSelectSegment(segmentId, additive = false) {
    setSelectedSegmentIds((current) => {
      if (!additive) return new Set([segmentId]);
      const next = new Set(current);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  }

  return (
    <section
      className="inventory-board-view"
      style={{ "--active-tab-color": activeTab?.color || "#2563eb" }}
    >
      <InventoryTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={onSelectTab}
        onCreate={onCreateTab}
        onRename={onRenameTab}
        onDelete={onDeleteTab}
        onColorChange={onChangeTabColor}
        activePopoverId={activePopoverId}
        setActivePopoverId={setActivePopoverId}
      />

      <div className="inventory-view-switch" role="tablist" aria-label="Visualizacao do inventario">
        <button
          type="button"
          className={inventoryViewMode === "board" ? "active" : ""}
          onClick={() => setInventoryViewMode("board")}
          aria-selected={inventoryViewMode === "board"}
        >
          <Database size={16} />
          Quadro
        </button>
        {floorPlansView && (
          <button
            type="button"
            className={inventoryViewMode === "floor-plans" ? "active" : ""}
            onClick={() => setInventoryViewMode("floor-plans")}
            aria-selected={inventoryViewMode === "floor-plans"}
          >
            <MapIcon size={16} />
            Plantas
          </button>
        )}
        {visualMapView && (
          <button
            type="button"
            className={inventoryViewMode === "visual-map" ? "active" : ""}
            onClick={() => setInventoryViewMode("visual-map")}
            aria-selected={inventoryViewMode === "visual-map"}
          >
            <Box size={16} />
            Mapa 3D
          </button>
        )}
      </div>

      {inventoryViewMode === "board" ? (
        <>
      <section className="inventory-tab-panel">
        <div className="inventory-board-actions">
          <div className={`search-box compact-search ${searchFocused || search ? "expanded" : ""}`}>
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Buscar maquina, IP, sistema ou segmento"
            />
          </div>
          <button
            type="button"
            className={`inventory-filter-toggle ${filtersOpen ? "active" : ""}`}
            onClick={() => setFiltersOpen((current) => !current)}
            aria-expanded={filtersOpen}
            aria-label="Filtros do inventário"
            title="Filtros do inventário"
          >
            <ListFilter size={18} />
            <span>Filtros</span>
            <ChevronDown size={16} />
          </button>
          {filtersOpen && (
          <div className="inventory-filter-panel open" aria-label="Filtros do inventário">
          <div className="group-filter-control expanded-filter" title="Filtrar por aba">
            <span>Aba</span>
            <select
              className="group-filter-select"
              value={activeTabId}
              onChange={(event) => onSelectTab?.(event.target.value)}
              aria-label="Filtrar por aba"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>{tab.name}</option>
              ))}
            </select>
          </div>
          <div className="group-filter-control" title="Filtrar por grupo">
            <span>Grupo</span>
            <select
              className="group-filter-select"
              value={selectedGroupId}
              onChange={(event) => onSelectGroup?.(event.target.value)}
              aria-label="Filtrar por grupo"
            >
              <option value="all">Todos os grupos</option>
              <option value="ungrouped">Sem grupo</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
          <div className="group-filter-control" title="Filtrar por segmento">
            <span>Segmento</span>
            <select
              className="group-filter-select"
              value={selectedSegmentId}
              onChange={(event) => onSelectSegment?.(event.target.value)}
              aria-label="Filtrar por segmento"
            >
              <option value="all">Todos os segmentos</option>
              {segments.map((segment) => (
                <option key={segment.id} value={segment.id}>{segment.name}</option>
              ))}
            </select>
          </div>
          {backupSegment && (
            <button
              type="button"
              className={`group-filter-control inventory-filter-chip ${selectedSegmentId === backupSegment.id ? "active" : ""}`}
              onClick={() => onSelectSegment?.(selectedSegmentId === backupSegment.id ? "all" : backupSegment.id)}
            >
              Backup
            </button>
          )}
          {maintenanceSegment && (
            <button
              type="button"
              className={`group-filter-control inventory-filter-chip ${selectedSegmentId === maintenanceSegment.id ? "active" : ""}`}
              onClick={() => onSelectSegment?.(selectedSegmentId === maintenanceSegment.id ? "all" : maintenanceSegment.id)}
            >
              Manutenção
            </button>
          )}
          </div>
          )}
          {canManage && (
            <div className="inventory-create-actions">
              <button className="primary-action compact-action" onClick={onCreateManualAsset}>
                <Plus size={16} />
                Ativo de rede
              </button>
              <button className="secondary-action compact-action" onClick={onCreateSegment}>
                <Plus size={16} />
                Segmento
              </button>
              <button className="secondary-action compact-action" onClick={onCreateGroup}>
                <Plus size={16} />
                Grupo
              </button>
            </div>
          )}
        </div>
      </section>

      <BulkActionsBar
        count={selectedAssetIds.size}
        segments={segments}
        currentTarget={bulkMoveTarget}
        onTargetChange={onBulkMoveTargetChange}
        onMove={onBulkMove}
        onPrint={onBulkPrint}
        onMarkBackup={onBulkMarkBackup}
        onClear={onClearSelection}
        isDragActive={isBulkSelectionDragging}
      />

      <section className="segment-stack" aria-label="Segmentos de inventario">
        {groupedSections.map((group, groupIndex) => (
          <SegmentGroupContainer key={group.id} groupId={group.id} color={group.color || activeTab?.color}>
            <header>
              <div className="group-header-main">
                <span className="segment-filter-dot group" style={{ backgroundColor: group.color || activeTab?.color || "#8b9bb0" }} />
                <div className="group-title-copy">
                  <strong>{group.name}</strong>
                  <span>{group.segments.length} segmentos</span>
                </div>
              </div>
              <div className="group-header-actions">
                {activePopoverId === `group-actions-${group.id}` && (
                  <div className="inline-action-strip group-inline-actions" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="inline-action-button"
                      onClick={() => {
                        onToggleGroup(group.id);
                        setActivePopoverId(null);
                      }}
                      title={group.collapsed ? "Expandir grupo" : "Ocultar grupo"}
                      aria-label={group.collapsed ? "Expandir grupo" : "Ocultar grupo"}
                    >
                      <ChevronDown size={15} className={group.collapsed ? "rotated" : ""} />
                    </button>
                    {canManage && groupIndex > 0 && (
                      <button
                        type="button"
                        className="inline-action-button"
                        onClick={() => {
                          onMoveGroupOrder?.(group.id, "up");
                          setActivePopoverId(null);
                        }}
                        title="Subir grupo"
                        aria-label="Subir grupo"
                      >
                        <ArrowUp size={15} />
                      </button>
                    )}
                    {canManage && groupIndex < groupedSections.length - 1 && (
                      <button
                        type="button"
                        className="inline-action-button"
                        onClick={() => {
                          onMoveGroupOrder?.(group.id, "down");
                          setActivePopoverId(null);
                        }}
                        title="Descer grupo"
                        aria-label="Descer grupo"
                      >
                        <ArrowDown size={15} />
                      </button>
                    )}
                    {canManage && (
                      <ColorPickerSegment
                        color={group.color || activeTab?.color}
                        onChange={(color) => onChangeGroupColor?.(group.id, color)}
                        title="Alterar cor do grupo"
                      />
                    )}
                    {canManage && (
                      <button
                        type="button"
                        className="inline-action-button"
                        onClick={() => {
                          onRenameGroup(group.id);
                          setActivePopoverId(null);
                        }}
                        title="Renomear grupo"
                        aria-label="Renomear grupo"
                      >
                        <Edit3 size={15} />
                      </button>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        className="inline-action-button danger"
                        onClick={() => {
                          onDeleteGroup(group.id);
                          setActivePopoverId(null);
                        }}
                        title="Excluir grupo"
                        aria-label="Excluir grupo"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="group-icon-action group-options-trigger"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActivePopoverId(activePopoverId === `group-actions-${group.id}` ? null : `group-actions-${group.id}`);
                  }}
                  title="Ações do grupo"
                  aria-label="Ações do grupo"
                  aria-expanded={activePopoverId === `group-actions-${group.id}`}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </header>
            {!group.collapsed && (
              group.segments.length ? group.segments.map((segment, segmentIndex) => (
                <SegmentCard
                  key={segment.id}
                  segment={segment}
                  machines={machinesBySegment.get(segment.id) || []}
                  segments={segments}
                  groups={groups}
                  aliases={aliases}
                  selectedAssetIds={selectedAssetIds}
                  canManage={canManage}
                  onRename={onRenameSegment}
                  onDelete={onDeleteSegment}
                  onColorChange={onChangeSegmentColor}
                  onMoveMachine={onMoveMachine}
                  onOpenDetails={setSelectedMachine}
                  onOpenMoveModal={onOpenMoveModal}
                  onRefreshPing={onRefreshPing}
                  onSelectAsset={onSelectAsset}
                  onToggleSelection={onToggleSelection}
                  onMoveSegmentToGroup={onMoveSegmentToGroup}
                  onMoveSegmentOrder={onMoveSegmentOrder}
                  canMoveSegmentUp={segmentIndex > 0}
                  canMoveSegmentDown={segmentIndex < group.segments.length - 1}
                  selected={selectedSegmentIds.has(segment.id)}
                  onSelectSegment={handleSelectSegment}
                  onRemovePeripheral={onRemovePeripheral}
                  activePopoverId={activePopoverId}
                  setActivePopoverId={setActivePopoverId}
                />
              )) : (
                <div className="segment-group-empty">
                  <strong>Grupo vazio</strong>
                  <span>Use o seletor "Sem grupo" no cabecalho de um segmento para mover ele para ca.</span>
                </div>
              )
            )}
          </SegmentGroupContainer>
        ))}
        {showUngroupedSection && (
          <SegmentGroupContainer groupId="" className="ungrouped-section" color={activeTab?.color}>
            <header>
              <div className="group-header-main">
                <span className="segment-filter-dot group" />
                <div className="group-title-copy">
                  <strong>Sem grupo</strong>
                  <span>{regularUngroupedSegments.length} segmentos</span>
                </div>
              </div>
            </header>
            {regularUngroupedSegments.map((segment, segmentIndex) => (
              <SegmentCard
                key={segment.id}
                segment={segment}
                machines={machinesBySegment.get(segment.id) || []}
                segments={segments}
                groups={groups}
                aliases={aliases}
                selectedAssetIds={selectedAssetIds}
                canManage={canManage}
                onRename={onRenameSegment}
                onDelete={onDeleteSegment}
                onColorChange={onChangeSegmentColor}
                onMoveMachine={onMoveMachine}
                onOpenDetails={setSelectedMachine}
                onOpenMoveModal={onOpenMoveModal}
                onRefreshPing={onRefreshPing}
                onSelectAsset={onSelectAsset}
                onToggleSelection={onToggleSelection}
                onMoveSegmentToGroup={onMoveSegmentToGroup}
                onMoveSegmentOrder={onMoveSegmentOrder}
                canMoveSegmentUp={segmentIndex > 0}
                canMoveSegmentDown={segmentIndex < regularUngroupedSegments.length - 1}
                selected={selectedSegmentIds.has(segment.id)}
                onSelectSegment={handleSelectSegment}
                onRemovePeripheral={onRemovePeripheral}
                activePopoverId={activePopoverId}
                setActivePopoverId={setActivePopoverId}
              />
            ))}
          </SegmentGroupContainer>
        )}
        {defaultUngroupedSegments.map((segment) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            machines={machinesBySegment.get(segment.id) || []}
            segments={segments}
            groups={groups}
            aliases={aliases}
            selectedAssetIds={selectedAssetIds}
            canManage={canManage}
            onRename={onRenameSegment}
            onDelete={onDeleteSegment}
            onColorChange={onChangeSegmentColor}
            onMoveMachine={onMoveMachine}
            onOpenDetails={setSelectedMachine}
            onOpenMoveModal={onOpenMoveModal}
            onRefreshPing={onRefreshPing}
            onSelectAsset={onSelectAsset}
            onToggleSelection={onToggleSelection}
            onMoveSegmentToGroup={onMoveSegmentToGroup}
            onMoveSegmentOrder={onMoveSegmentOrder}
            canMoveSegmentUp={false}
            canMoveSegmentDown={false}
            hideGroupSelect
            selected={selectedSegmentIds.has(segment.id)}
            onSelectSegment={handleSelectSegment}
            onRemovePeripheral={onRemovePeripheral}
            activePopoverId={activePopoverId}
            setActivePopoverId={setActivePopoverId}
          />
        ))}
        {!visibleSegments.length && (
          <section className="segment-card empty-only">
            <Database size={24} />
            <p>Nenhum segmento encontrado.</p>
          </section>
        )}
      </section>
        </>
      ) : inventoryViewMode === "floor-plans" ? floorPlansView : visualMapView}

      <MoveMachineModal
        machine={moveModal}
        segments={segments.filter((segment) => !segment.isBackupSegment)}
        targetSegmentId={moveTarget}
        onTargetChange={setMoveTarget}
        onClose={onCloseMoveModal}
        onConfirm={() => onMoveMachine(moveModal, moveTarget)}
      />
      <MachineDetailsModal
        machine={selectedMachine}
        alias={selectedMachine ? aliases[selectedMachine.id] : ""}
        observations={selectedMachine ? observations[selectedMachine.id] || [] : []}
        segmentColor={segments.find((segment) => segment.id === selectedMachine?.segmentId)?.color}
        userName={userName}
        onAliasSave={(nextAlias) => onAliasSave(selectedMachine.id, nextAlias)}
        onAddObservation={(text) => onAddObservation(selectedMachine.id, text)}
        onChangeDeviceType={handleSelectedTypeChange}
        onRefreshPing={handleSelectedPingRefresh}
        onPutMaintenance={async () => {
          const moved = await onPutMaintenance?.(selectedMachine);
          if (moved) setSelectedMachine(null);
        }}
        onToggleBackup={async (desiredState) => {
          const updated = await onToggleBackup?.(selectedMachine, desiredState);
          if (updated) setSelectedMachine(null);
        }}
        onRemoveMachine={async () => {
          const removed = await onRemoveMachine?.(selectedMachine);
          if (removed) setSelectedMachine(null);
        }}
        onRemovePeripheral={(peripheral) => {
          const event = onRemovePeripheral(selectedMachine.id, peripheral);
          if (event) {
            setSelectedMachine((current) => ({
              ...current,
              assetHistory: [event, ...(current.assetHistory || [])],
              hardware: {
                ...current.hardware,
                peripherals: (current.hardware?.peripherals || []).filter((item) =>
                  (item.id || `${item.type}-${item.brand}-${item.assetTag}`) !==
                  (peripheral.id || `${peripheral.type}-${peripheral.brand}-${peripheral.assetTag}`)
                )
              }
            }));
          }
          return event;
        }}
        onClose={() => setSelectedMachine(null)}
      />
    </section>
  );
}
