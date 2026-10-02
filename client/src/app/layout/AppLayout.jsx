import { useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { useLayout } from "../context/workspaceContexts.js";
import AppModals from "./AppModals.jsx";
import InventoryDragLayer from "./InventoryDragLayer.jsx";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { inventoryCollisionDetection } from "./dragGeometry.js";

// Casca visual do app autenticado: sidebar + topbar + area de conteudo
// (`children` recebe as visoes roteadas), tudo dentro do DndContext do
// inventario porque a sidebar tambem e alvo de soltar.
export default function AppLayout({ children }) {
  const { drag, sidebar } = useLayout();
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);

  return (
    <DndContext
      sensors={drag.sensors}
      collisionDetection={inventoryCollisionDetection}
      onDragStart={drag.handleDragStart}
      onDragEnd={drag.handleDragEnd}
      onDragCancel={drag.handleDragCancel}
    >
      <main className={`app-shell ${sidebar.expanded ? "" : "sidebar-collapsed"} ${sidebar.dragActive ? "sidebar-drag-active" : ""}`}>
        <Sidebar onOpenSettings={() => setGeneralSettingsOpen(true)} />
        <section className="workspace">
          <Topbar />
          {children}
        </section>
        <AppModals
          generalSettingsOpen={generalSettingsOpen}
          onCloseGeneralSettings={() => setGeneralSettingsOpen(false)}
        />
      </main>
      <InventoryDragLayer />
    </DndContext>
  );
}
