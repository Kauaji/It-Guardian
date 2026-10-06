import { PanelLeftClose, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { useLayout } from "../context/workspaceContexts.js";
import { useViewAccess } from "../hooks/useViewAccess.js";
import SidebarNav from "./SidebarNav.jsx";

export default function Sidebar({ onOpenSettings }) {
  const { canOpenGeneralSettings } = useViewAccess();
  const { sidebar } = useLayout();

  return (
    <aside className="sidebar" onMouseEnter={sidebar.handleMouseEnter} onMouseLeave={sidebar.handleMouseLeave}>
      <button
        type="button"
        className="brand-mark compact sidebar-brand-toggle"
        onClick={sidebar.toggleCollapsed}
        title={sidebar.expanded ? "Recolher sidebar" : "Expandir sidebar"}
      >
        <ShieldCheck size={28} />
        <strong>IT Guardian</strong>
        <PanelLeftClose size={16} className="sidebar-collapse-indicator" />
      </button>
      <SidebarNav />
      {canOpenGeneralSettings && (
        <div className="sidebar-footer">
          <button type="button" className="sidebar-general-settings-button" onClick={onOpenSettings} title="Configurações gerais">
            <SettingsIcon size={18} />
            <span className="nav-label">Configurações</span>
          </button>
        </div>
      )}
    </aside>
  );
}
