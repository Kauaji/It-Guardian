import { useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { useLayout, useNavigation } from "../context/workspaceContexts.js";
import { labelForView } from "../routes.js";
import AppModals from "./AppModals.jsx";
import InventoryDragLayer from "./InventoryDragLayer.jsx";
import Sidebar from "./Sidebar.jsx";
import SkipLink, { MAIN_CONTENT_ID } from "./SkipLink.jsx";
import Topbar from "./Topbar.jsx";
import { inventoryCollisionDetection } from "./dragGeometry.js";

// Casca visual do app autenticado: sidebar + topbar + area de conteudo
// (`children` recebe as visoes roteadas), tudo dentro do DndContext do
// inventario porque a sidebar tambem e alvo de soltar.
export default function AppLayout({ children }) {
  const { drag, sidebar } = useLayout();
  const { activeView } = useNavigation();
  useDocumentTitle(labelForView(activeView));
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);

  return (
    <DndContext
      sensors={drag.sensors}
      collisionDetection={inventoryCollisionDetection}
      onDragStart={drag.handleDragStart}
      onDragEnd={drag.handleDragEnd}
      onDragCancel={drag.handleDragCancel}
    >
      <div className={`app-shell ${sidebar.expanded ? "" : "sidebar-collapsed"} ${sidebar.dragActive ? "sidebar-drag-active" : ""}`}>
        <SkipLink />
        <Sidebar onOpenSettings={() => setGeneralSettingsOpen(true)} />
        <div className="workspace">
          <Topbar />
          <main id={MAIN_CONTENT_ID} className="workspace-main" tabIndex={-1}>
            {children}
          </main>
        </div>
        <AppModals generalSettingsOpen={generalSettingsOpen} onCloseGeneralSettings={() => setGeneralSettingsOpen(false)} />
      </div>
      <InventoryDragLayer />
    </DndContext>
  );
}
