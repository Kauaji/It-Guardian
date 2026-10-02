import SidebarSegmentFilter from "../../components/inventory/SidebarSegmentFilter.jsx";
import { useInventory, useInventoryActions, useLayout } from "../context/workspaceContexts.js";

// Filtro de grupos/segmentos exibido na sidebar enquanto o inventario esta
// aberto; tambem serve de alvo para soltar ativos e segmentos.
export default function SidebarInventoryFilter() {
  const { filters, model } = useInventory();
  const { groups } = useInventoryActions();
  const { drag } = useLayout();

  return (
    <SidebarSegmentFilter
      devices={model.activeAllDevices}
      segments={model.activeSegments}
      groups={model.activeSegmentGroups}
      selectedGroupId={filters.selectedInventoryGroup}
      selectedSegmentId={filters.selectedInventorySegment}
      machineDragActive={Boolean(drag.activeDragMachine)}
      onSelectGroup={filters.selectInventoryGroup}
      onSelectSegment={filters.selectInventorySegment}
      onToggleGroup={groups.toggleSegmentGroup}
    />
  );
}
