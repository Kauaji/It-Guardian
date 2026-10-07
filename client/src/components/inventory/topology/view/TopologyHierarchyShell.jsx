import NetworkTopologyBreadcrumb from "../NetworkTopologyBreadcrumb.jsx";
import NetworkTopologyHierarchySidebar from "../NetworkTopologyHierarchySidebar.jsx";
import NetworkTopologyNavigation from "../NetworkTopologyNavigation.jsx";

/**
 * Moldura do Mapa de Rede: breadcrumb, link para a visao global legada, barra lateral da
 * hierarquia (Aba -> Grupo -> Segmento) e a area principal com o nivel atual.
 */
export default function TopologyHierarchyShell({ nav, tabs, activeTab, onSelectTab, tree, children }) {
  return (
    <div className="network-topology-view">
      <div className="network-topology-hierarchy-header">
        <NetworkTopologyBreadcrumb crumbs={nav.crumbs} />
        {nav.viewLevel !== "global-legado" ? (
          <button type="button" className="network-topology-legacy-link" onClick={nav.goToGlobalLegacy}>
            Visão global (legado)
          </button>
        ) : null}
      </div>
      <div className="network-topology-hierarchy-layout">
        <NetworkTopologyNavigation>
          <NetworkTopologyHierarchySidebar
            tabs={tabs}
            activeTabId={activeTab?.id}
            onSelectTab={(tabId) => {
              onSelectTab?.(tabId);
              nav.goToTabLevel();
            }}
            tree={tree}
            selectedGroupId={nav.selectedGroupId}
            selectedSegmentId={nav.selectedSegmentId}
            onSelectGroup={nav.goToGroupLevel}
            onSelectSegment={nav.goToSegmentLevel}
          />
        </NetworkTopologyNavigation>
        <div className="network-topology-hierarchy-main">{children}</div>
      </div>
    </div>
  );
}
