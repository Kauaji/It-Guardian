import { ChevronDown, ChevronRight, FolderTree, Layers, Search, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { searchCatalogItems } from "../../floorPlans/utils/catalogSearch.js";
import AssetTypeIcon from "../AssetTypeIcon.jsx";
import { resolveAssetType, resolveNodeStatusTone } from "./networkTopologyModel.js";
import { getAggregateStatusColorToken } from "./networkTopologyHierarchy.js";
import PulseDot from "../../ui/PulseDot.jsx";

/**
 * Arvore Grupo -> Segmento -> Ativo da aba atual, para navegar a hierarquia
 * sem depender so do canvas. Cada segmento pode ser expandido para ver os
 * ativos que ja estao nele (so leitura - adicionar/remover ativo continua
 * so dentro do mapa do segmento, via NetworkTopologyAddAssetPicker).
 */
export default function NetworkTopologyHierarchySidebar({
  tabs,
  activeTabId,
  onSelectTab,
  tree,
  selectedGroupId,
  selectedSegmentId,
  onSelectGroup,
  onSelectSegment
}) {
  const [query, setQuery] = useState("");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(() => new Set());
  const [expandedSegmentIds, setExpandedSegmentIds] = useState(() => new Set());

  const sections = useMemo(
    () => [
      {
        id: "groups",
        label: "Grupos",
        items: tree.groups.map((group) => ({ id: group.id, label: group.name, tags: ["grupo"] }))
      },
      {
        id: "segments",
        label: "Segmentos",
        items: [
          ...tree.groups.flatMap((group) => group.segments.map((segment) => ({ id: segment.id, label: segment.name, tags: ["segmento", group.name] }))),
          ...tree.ungroupedSegments.map((segment) => ({ id: segment.id, label: segment.name, tags: ["segmento"] })),
          ...(tree.maintenanceSegments || []).map((segment) => ({ id: segment.id, label: segment.name, tags: ["segmento", "manutenção"] }))
        ]
      }
    ],
    [tree]
  );
  const searchResults = query.trim() ? searchCatalogItems(sections, query) : null;
  const matchedGroupIds = searchResults ? new Set(searchResults.filter((item) => item.sectionId === "groups").map((item) => item.id)) : null;
  const matchedSegmentIds = searchResults ? new Set(searchResults.filter((item) => item.sectionId === "segments").map((item) => item.id)) : null;

  function toggleGroupCollapsed(groupId) {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function toggleSegmentExpanded(segmentId) {
    setExpandedSegmentIds((current) => {
      const next = new Set(current);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  }

  const visibleGroups = matchedGroupIds
    ? tree.groups.filter((group) => matchedGroupIds.has(group.id) || group.segments.some((segment) => matchedSegmentIds.has(segment.id)))
    : tree.groups;
  const visibleUngrouped = matchedSegmentIds
    ? tree.ungroupedSegments.filter((segment) => matchedSegmentIds.has(segment.id))
    : tree.ungroupedSegments;
  const visibleMaintenance = matchedSegmentIds
    ? (tree.maintenanceSegments || []).filter((segment) => matchedSegmentIds.has(segment.id))
    : (tree.maintenanceSegments || []);

  function renderSegmentRow(segment, groupId) {
    const expanded = expandedSegmentIds.has(segment.id);
    const devices = segment.devices || [];
    return (
      <div className="network-topology-hierarchy-segment" key={segment.id}>
        <div className="network-topology-hierarchy-row">
          <button
            type="button"
            className="network-topology-hierarchy-collapse-toggle"
            onClick={() => toggleSegmentExpanded(segment.id)}
            aria-label={`${expanded ? "Recolher" : "Expandir"} segmento ${segment.name}`}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <button
            type="button"
            className={`network-topology-hierarchy-item ${selectedSegmentId === segment.id ? "is-selected" : ""}`}
            onClick={() => onSelectSegment(segment.id, groupId)}
          >
            {segment.isMaintenanceSegment ? <Wrench size={14} /> : <Layers size={14} />}
            <span
              className="network-topology-hierarchy-status-dot"
              style={{ background: getAggregateStatusColorToken(segment.status) }}
            />
            <span>{segment.name}</span>
            <span className="network-topology-hierarchy-count">{segment.deviceCount}</span>
          </button>
        </div>
        {expanded ? (
          <div className="network-topology-hierarchy-devices">
            {devices.map((device) => (
              <button
                type="button"
                key={device.id}
                className="network-topology-hierarchy-device"
                onClick={() => onSelectSegment(segment.id, groupId)}
              >
                <AssetTypeIcon type={resolveAssetType(device)} size={12} />
                <PulseDot tone={resolveNodeStatusTone(device)} className="network-topology-hierarchy-device-pulse" />
                <span>{device.name}</span>
              </button>
            ))}
            {!devices.length ? <p className="network-topology-hierarchy-empty">Sem ativos.</p> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <nav className="network-topology-hierarchy-sidebar" aria-label="Hierarquia do inventário">
      {tabs?.length > 1 ? (
        <div className="network-topology-tab-chips" role="tablist" aria-label="Abas do inventário">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              role="tab"
              aria-selected={tab.id === activeTabId}
              className={tab.id === activeTabId ? "active" : ""}
              onClick={() => onSelectTab(tab.id)}
            >
              {tab.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="network-topology-hierarchy-search">
        <Search size={14} />
        <input
          type="search"
          aria-label="Buscar grupo ou segmento"
          placeholder="Buscar grupo ou segmento..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="network-topology-hierarchy-tree">
        {visibleGroups.map((group) => {
          const collapsed = collapsedGroupIds.has(group.id) && !matchedGroupIds;
          return (
            <div className="network-topology-hierarchy-group" key={group.id}>
              <div className="network-topology-hierarchy-row">
                <button
                  type="button"
                  className="network-topology-hierarchy-collapse-toggle"
                  onClick={() => toggleGroupCollapsed(group.id)}
                  aria-label={`${collapsed ? "Expandir" : "Recolher"} grupo ${group.name}`}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <button
                  type="button"
                  className={`network-topology-hierarchy-item ${selectedGroupId === group.id ? "is-selected" : ""}`}
                  onClick={() => onSelectGroup(group.id)}
                >
                  <FolderTree size={15} />
                  <span
                    className="network-topology-hierarchy-status-dot"
                    style={{ background: getAggregateStatusColorToken(group.status) }}
                  />
                  <strong>{group.name}</strong>
                  <span className="network-topology-hierarchy-count" title={`${group.deviceCount} ativo(s) em ${group.segmentCount} segmento(s)`}>{group.deviceCount}</span>
                </button>
              </div>
              {!collapsed ? (
                <div className="network-topology-hierarchy-children">
                  {group.segments.map((segment) => renderSegmentRow(segment, group.id))}
                  {!group.segments.length ? (
                    <p className="network-topology-hierarchy-empty">Sem segmentos.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        {visibleUngrouped.length ? (
          <div className="network-topology-hierarchy-group">
            <div className="network-topology-hierarchy-row">
              <span className="network-topology-hierarchy-collapse-toggle-spacer" />
              <span className="network-topology-hierarchy-item is-heading">
                <strong>Sem grupo</strong>
              </span>
            </div>
            <div className="network-topology-hierarchy-children">
              {visibleUngrouped.map((segment) => renderSegmentRow(segment, null))}
            </div>
          </div>
        ) : null}

        {visibleMaintenance.length ? (
          <div className="network-topology-hierarchy-maintenance" aria-label="Segmentos de manutenção independentes">
            {visibleMaintenance.map((segment) => renderSegmentRow(segment, null))}
          </div>
        ) : null}

        {!visibleGroups.length && !visibleUngrouped.length && !visibleMaintenance.length ? (
          <p className="network-topology-hierarchy-empty">Nenhum grupo ou segmento encontrado.</p>
        ) : null}
      </div>
    </nav>
  );
}
