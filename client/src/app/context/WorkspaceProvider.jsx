import { useWorkspace } from "../hooks/useWorkspace.js";
import { AlertFiltersProvider } from "./AlertFiltersContext.jsx";
import {
  DataProvider,
  InventoryActionsProvider,
  InventoryProvider,
  LayoutProvider,
  NavigationProvider,
  ServiceOrderActionsProvider
} from "./workspaceContexts.js";

// Executa os hooks de dominio uma unica vez e publica cada fatia em seu
// proprio contexto, para que sidebar, topbar e visoes leiam so o que usam.
export default function WorkspaceProvider({ children }) {
  const workspace = useWorkspace();

  return (
    <NavigationProvider value={workspace.navigation}>
      <DataProvider value={workspace.data}>
        <InventoryProvider value={workspace.inventory}>
          <InventoryActionsProvider value={workspace.inventoryActions}>
            <ServiceOrderActionsProvider value={workspace.serviceOrders}>
              <LayoutProvider value={workspace.layout}>
                <AlertFiltersProvider>{children}</AlertFiltersProvider>
              </LayoutProvider>
            </ServiceOrderActionsProvider>
          </InventoryActionsProvider>
        </InventoryProvider>
      </DataProvider>
    </NavigationProvider>
  );
}
