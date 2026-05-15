import { useEffect, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ArrowDown, ArrowUp, ChevronDown, Database, Edit3, ListFilter, Plus, Search, Trash2 } from "lucide-react";
import SegmentCard from "./SegmentCard.jsx";
import MoveMachineModal from "./MoveMachineModal.jsx";
import MachineDetailsModal from "./MachineDetailsModal.jsx";
import BulkActionsBar from "./BulkActionsBar.jsx";
import InventoryTabs from "./InventoryTabs.jsx";

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
  devices,
  segments,
  machinesBySegment,
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
  onClearSelection,
  onSelectAsset,
  onToggleSelection,
  groups = [],
  onSelectGroup,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
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
  onCloseMoveModal,
  onOpenMoveModal
}) {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [activePopoverId, setActivePopoverId] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
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
  const getGroupId = (segment) => segmentGroupIdMap.get(segment.id) || "";
  const visibleSegments = useMemo(() => segments.filter((segment) => {
    if (selectedSegmentId !== "all") return segment.id === selectedSegmentId;

    const groupId = segmentGroupIdMap.get(segment.id) || "";
    if (selectedGroupId === "ungrouped") return !groupId;
    if (selectedGroupId !== "all") return groupId === selectedGroupId;
    return true;
  }), [segmentGroupIdMap, segments, selectedGroupId, selectedSegmentId]);
  const groupedSections = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          segments: visibleSegments.filter((segment) => (segmentGroupIdMap.get(segment.id) || "") === group.id)
        }))
        .filter((group) => {
          if (selectedGroupId !== "all" && selectedGroupId !== group.id) return false;
          return selectedSegmentId === "all" || group.segments.length;
        }),
    [groups, segmentGroupIdMap, selectedGroupId, selectedSegmentId, visibleSegments]
  );
  const ungroupedSegments = useMemo(
    () => visibleSegments.filter((segment) => !(segmentGroupIdMap.get(segment.id) || "")),
    [segmentGroupIdMap, visibleSegments]
  );
  const defaultUngroupedSegments = useMemo(
    () =>
      segments.filter((segment) => {
        if (!segment.isDefault) return false;
        if (selectedSegmentId !== "all") return selectedSegmentId === segment.id;
        return selectedGroupId === "all" || selectedGroupId === "ungrouped";
      }),
    [segments, selectedGroupId, selectedSegmentId]
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
  }, [activeTabId, selectedGroupId, selectedSegmentId]);

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
          <div className="group-filter-control" title="Filtrar por grupo">
            <ListFilter size={17} aria-hidden="true" />
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
                <button
                  type="button"
                  className={`group-icon-action ${group.collapsed ? "collapsed" : ""}`}
                  onClick={() => onToggleGroup(group.id)}
                  title={group.collapsed ? "Expandir grupo" : "Ocultar grupo"}
                  aria-label={group.collapsed ? "Expandir grupo" : "Ocultar grupo"}
                >
                  <ChevronDown size={16} />
                </button>
                {canManage && (
                  <>
                    {groupIndex > 0 && (
                      <button
                        type="button"
                        className="group-icon-action"
                        onClick={() => onMoveGroupOrder?.(group.id, "up")}
                        title="Subir grupo"
                        aria-label="Subir grupo"
                      >
                        <ArrowUp size={15} />
                      </button>
                    )}
                    {groupIndex < groupedSections.length - 1 && (
                      <button
                        type="button"
                        className="group-icon-action"
                        onClick={() => onMoveGroupOrder?.(group.id, "down")}
                        title="Descer grupo"
                        aria-label="Descer grupo"
                      >
                        <ArrowDown size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="group-icon-action"
                      onClick={() => onRenameGroup(group.id)}
                      title="Renomear grupo"
                      aria-label="Renomear grupo"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      className="group-icon-action"
                      onClick={() => onDeleteGroup(group.id)}
                      title="Excluir grupo"
                      aria-label="Excluir grupo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
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
            onRemovePeripheral={onRemovePeripheral}
            activePopoverId={activePopoverId}
            setActivePopoverId={setActivePopoverId}
          />
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
                onRemovePeripheral={onRemovePeripheral}
                activePopoverId={activePopoverId}
                setActivePopoverId={setActivePopoverId}
              />
            ))}
          </SegmentGroupContainer>
        )}
        {!visibleSegments.length && (
          <section className="segment-card empty-only">
            <Database size={24} />
            <p>Nenhum segmento encontrado.</p>
          </section>
        )}
      </section>

      <MoveMachineModal
        machine={moveModal}
        segments={segments}
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
