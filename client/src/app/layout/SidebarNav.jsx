import { Activity, AlertTriangle, CalendarDays, ClipboardList, Database, PackageSearch } from "lucide-react";
import { useNavigation, useLayout } from "../context/workspaceContexts.js";
import { useViewAccess } from "../hooks/useViewAccess.js";
import { labelForView } from "../routes.js";
import SidebarInventoryFilter from "./SidebarInventoryFilter.jsx";

// Os itens continuam sendo <button> (e nao <a>): os testes e2e e os leitores
// de tela os localizam pelo papel "button" e pelo texto do rotulo.
const navItems = [
  { viewId: "dashboard", icon: Activity, isVisible: (access) => access.canViewDashboard },
  { viewId: "alerts", icon: AlertTriangle, isVisible: (access) => access.showAlertsNav },
  { viewId: "service-orders", icon: ClipboardList, isVisible: (access) => access.canViewServiceOrders },
  { viewId: "calendar", icon: CalendarDays, isVisible: (access) => access.canViewCalendar },
  { viewId: "parts-inventory", icon: PackageSearch, isVisible: (access) => access.canViewPartsInventory },
  { viewId: "inventory", icon: Database, isVisible: (access) => access.canViewInventory }
];

export default function SidebarNav() {
  const access = useViewAccess();
  const { activeView, goToView, openInventory } = useNavigation();
  const { sidebar } = useLayout();

  return (
    <nav aria-label="Navegação principal">
      {navItems
        .filter((item) => item.isVisible(access))
        .map(({ viewId, icon: Icon }) => (
          <button
            key={viewId}
            className={activeView === viewId ? "nav-active" : ""}
            aria-current={activeView === viewId ? "page" : undefined}
            onClick={() => (viewId === "inventory" ? openInventory() : goToView(viewId))}
          >
            <Icon size={18} aria-hidden="true" /> <span className="nav-label">{labelForView(viewId)}</span>
          </button>
        ))}
      {activeView === "inventory" && sidebar.expanded && <SidebarInventoryFilter />}
    </nav>
  );
}
