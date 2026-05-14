import { useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Database, Plus, Search, Trash2 } from "lucide-react";
import SegmentCard from "./SegmentCard.jsx";
import MoveMachineModal from "./MoveMachineModal.jsx";
import MachineDetailsModal from "./MachineDetailsModal.jsx";
import BulkActionsBar from "./BulkActionsBar.jsx";

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
  onMoveSegmentToGroup,
  onRemovePeripheral,
  onCreateManualAsset,
  onRefreshPing,
  onChangeDeviceType,
  onCloseMoveModal,
  onOpenMoveModal
}) {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [activePopoverId, setActivePopoverId] = useState(null);
  const getGroupId = (segment) =>
    segment.groupId || groups.find((group) => (group.segmentIds || []).includes(segment.id))?.id || "";
  const visibleSegments = segments.filter((segment) => {
    if (segment.isDefault && !(machinesBySegment.get(segment.id) || []).length) return false;
    if (selectedSegmentId !== "all") return segment.id === selectedSegmentId;

    const groupId = getGroupId(segment);
    if (selectedGroupId === "ungrouped") return !groupId;
    if (selectedGroupId !== "all") return groupId === selectedGroupId;
    return true;
  });
  const groupedSections = groups
    .map((group) => ({
      ...group,
      segments: visibleSegments.filter((segment) => getGroupId(segment) === group.id)
    }))
    .filter((group) => {
      if (selectedGroupId !== "all" && selectedGroupId !== group.id) return false;
      return selectedSegmentId === "all" || group.segments.length;
    });
  const ungroupedSegments = visibleSegments.filter((segment) => !getGroupId(segment));
  const showUngroupedSection =
    ungroupedSegments.length > 0 &&
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

    function closeActivePopover() {
      setActivePopoverId(null);
    }

    document.addEventListener("click", closeActivePopover);
    return () => document.removeEventListener("click", closeActivePopover);
  }, [activePopoverId]);

  return (
    <section className="inventory-board-view">
      <section className="inventory-board-toolbar">
        <div>
          <h2>Inventario por segmentos</h2>
          <p>Organize maquinas em grupos operacionais com drag-and-drop</p>
        </div>
        <div className="inventory-board-actions">
          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar maquina, IP, sistema ou segmento"
            />
          </div>
          <select
            className="group-filter-select"
            value={selectedGroupId}
            onChange={(event) => onSelectGroup?.(event.target.value)}
            title="Filtrar por grupo"
          >
            <option value="all">Todos os grupos</option>
            <option value="ungrouped">Sem grupo</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          {canManage && (
            <>
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
            </>
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
      />

      <section className="segment-stack" aria-label="Segmentos de inventario">
        {groupedSections.map((group) => (
          <SegmentGroupContainer key={group.id} groupId={group.id} color={group.color}>
            <header>
              <button type="button" onClick={() => onToggleGroup(group.id)}>
                {group.collapsed ? "Mostrar" : "Ocultar"}
              </button>
              <span className="segment-filter-dot group" />
              <strong>{group.name}</strong>
              <span>{group.segments.length} segmentos</span>
              {canManage && (
                <>
                  <button type="button" onClick={() => onRenameGroup(group.id)}>Renomear</button>
                  <button type="button" onClick={() => onDeleteGroup(group.id)} title="Excluir grupo">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </header>
            {!group.collapsed && (
              group.segments.length ? group.segments.map((segment) => (
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
          <SegmentGroupContainer groupId="" className="ungrouped-section">
            <header>
              <span className="segment-filter-dot group" />
              <strong>Sem grupo</strong>
              <span>{ungroupedSegments.length} segmentos</span>
            </header>
            {ungroupedSegments.map((segment) => (
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
