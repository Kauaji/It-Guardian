import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import HierarchyGroupBranch from "./hierarchySidebar/HierarchyGroupBranch.jsx";
import HierarchyTabChips from "./hierarchySidebar/HierarchyTabChips.jsx";
import HierarchyUngroupedBranch from "./hierarchySidebar/HierarchyUngroupedBranch.jsx";
import { buildSearchSections, filterHierarchy, toggleInSet } from "./hierarchySidebar/hierarchySidebarModel.js";

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

  const sections = useMemo(() => buildSearchSections(tree), [tree]);
  const { matchedGroupIds, visibleGroups, visibleUngrouped } = filterHierarchy(tree, sections, query);

  return (
    <nav className="network-topology-hierarchy-sidebar" aria-label="Hierarquia do inventário">
      <HierarchyTabChips tabs={tabs} activeTabId={activeTabId} onSelectTab={onSelectTab} />

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
        {visibleGroups.map((group) => (
          <HierarchyGroupBranch
            key={group.id}
            group={group}
            collapsed={collapsedGroupIds.has(group.id) && !matchedGroupIds}
            selectedGroupId={selectedGroupId}
            selectedSegmentId={selectedSegmentId}
            expandedSegmentIds={expandedSegmentIds}
            onToggleCollapsed={(groupId) => setCollapsedGroupIds((current) => toggleInSet(current, groupId))}
            onToggleSegmentExpanded={(segmentId) => setExpandedSegmentIds((current) => toggleInSet(current, segmentId))}
            onSelectGroup={onSelectGroup}
            onSelectSegment={onSelectSegment}
          />
        ))}

        {visibleUngrouped.length ? (
          <HierarchyUngroupedBranch
            segments={visibleUngrouped}
            selectedSegmentId={selectedSegmentId}
            expandedSegmentIds={expandedSegmentIds}
            onToggleSegmentExpanded={(segmentId) => setExpandedSegmentIds((current) => toggleInSet(current, segmentId))}
            onSelectSegment={onSelectSegment}
          />
        ) : null}

        {!visibleGroups.length && !visibleUngrouped.length ? (
          <p className="network-topology-hierarchy-empty">Nenhum grupo ou segmento encontrado.</p>
        ) : null}
      </div>
    </nav>
  );
}
