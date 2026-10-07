export default function BoardFilterPanel({
  tabs,
  groups,
  availableSegments,
  backupSegment,
  maintenanceSegment,
  activeTabId,
  selectedGroupId,
  selectedSegmentId,
  onSelectTab,
  onSelectGroup,
  onSelectSegment
}) {
  return (
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
            <option key={tab.id} value={tab.id}>
              {tab.name}
            </option>
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
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
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
          {availableSegments.map((segment) => (
            <option key={segment.id} value={segment.id}>
              {segment.name}
            </option>
          ))}
        </select>
      </div>
      {backupSegment && (
        <SegmentChip segment={backupSegment} label="Backup" selectedSegmentId={selectedSegmentId} onSelectSegment={onSelectSegment} />
      )}
      {maintenanceSegment && (
        <SegmentChip
          segment={maintenanceSegment}
          label="Manutenção"
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={onSelectSegment}
        />
      )}
    </div>
  );
}

function SegmentChip({ segment, label, selectedSegmentId, onSelectSegment }) {
  return (
    <button
      type="button"
      className={`group-filter-control inventory-filter-chip ${selectedSegmentId === segment.id ? "active" : ""}`}
      onClick={() => onSelectSegment?.(selectedSegmentId === segment.id ? "all" : segment.id)}
    >
      {label}
    </button>
  );
}
