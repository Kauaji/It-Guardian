import { useEffect } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { useInventoryPersistence } from "../../hooks/useInventoryPersistence.js";
import { activeInventoryTabKey } from "../../components/inventory/inventoryLocalState.js";
import { useAssetSelection } from "./useAssetSelection.js";
import { useBackupActions } from "./useBackupActions.js";
import { useBulkPrint } from "./useBulkPrint.js";
import { useDeviceStateUpdaters } from "./useDeviceStateUpdaters.js";
import { useInventoryAssetActions } from "./useInventoryAssetActions.js";
import { useInventoryDragController } from "./useInventoryDragController.js";
import { useInventoryFilters } from "./useInventoryFilters.js";
import { useInventoryMeta } from "./useInventoryMeta.js";
import { useInventoryModel } from "./useInventoryModel.js";
import { useInventoryMoves } from "./useInventoryMoves.js";
import { useInventoryTabActions } from "./useInventoryTabActions.js";
import { useMachinePeripherals } from "./useMachinePeripherals.js";
import { useMaintenanceEntry } from "./useMaintenanceEntry.js";
import { useMaintenanceExit } from "./useMaintenanceExit.js";
import { useSegmentForm } from "./useSegmentForm.js";
import { useSegmentGroupActions } from "./useSegmentGroupActions.js";
import { useSegmentMutations } from "./useSegmentMutations.js";
import { useServiceOrderBackupFlow } from "./useServiceOrderBackupFlow.js";
import { useServiceOrderCore } from "./useServiceOrderCore.js";
import { useServiceOrderLifecycle } from "./useServiceOrderLifecycle.js";
import { useSidebarState } from "./useSidebarState.js";
import { useWorkspaceDataLoader } from "./useWorkspaceDataLoader.js";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation.js";
import { useViewAccess } from "./useViewAccess.js";

// Compoe todos os hooks de dominio do app autenticado na ordem de dependencia
// e devolve as fatias publicadas pelo WorkspaceProvider.
export function useWorkspace() {
  const { token } = useAppSession();
  const access = useViewAccess();
  const navigation = useWorkspaceNavigation(access);
  const persistence = useInventoryPersistence(token);
  const data = useWorkspaceDataLoader({ access, activeView: navigation.activeView, persistence });

  // --- modelo de inventario (derivado), filtros e selecao ---
  const model = useInventoryModel({ data, persistence });
  const filters = useInventoryFilters({ model, persistence });
  const selection = useAssetSelection({
    activeAllDevices: model.activeAllDevices,
    visibleDevices: filters.filteredInventoryDevices
  });
  const inventory = { filters, model, persistence, selection };

  // Ao trocar de aba do inventario: lembra a aba e zera busca, filtros e selecao.
  useEffect(() => {
    localStorage.setItem(activeInventoryTabKey, model.activeInventoryTab.id);
    filters.resetInventoryFilters();
    selection.clearAssetSelection();
  }, [model.activeInventoryTab.id]);

  // --- acoes de inventario ---
  const meta = useInventoryMeta({ model, persistence });
  const deviceState = useDeviceStateUpdaters({ data });
  const moves = useInventoryMoves({ data, deviceState, inventory, meta });
  const serviceOrderCore = useServiceOrderCore({ data });
  const backup = useBackupActions({ data, deviceState, inventory });
  const maintenanceExit = useMaintenanceExit({ data, deviceState, inventory, moves });
  const maintenanceEntry = useMaintenanceEntry({
    data,
    deviceState,
    exit: maintenanceExit,
    inventory,
    meta,
    moves,
    serviceOrderCore
  });
  const segmentForm = useSegmentForm({ data, inventory, meta });
  const segmentMutations = useSegmentMutations({ data, deviceState, inventory, meta });
  const groups = useSegmentGroupActions({ data, inventory, meta });
  const tabs = useInventoryTabActions({ inventory });
  const assets = useInventoryAssetActions({ data, deviceState, inventory, meta });
  const peripherals = useMachinePeripherals({ deviceState, inventory });

  // --- Ordens de Servico que mexem no inventario ---
  const backupFlow = useServiceOrderBackupFlow({
    data,
    deviceState,
    inventory,
    maintenanceEntry,
    moves,
    serviceOrderCore
  });
  const lifecycle = useServiceOrderLifecycle({
    backupFlow,
    data,
    inventory,
    maintenanceExit,
    serviceOrderCore
  });

  // --- layout: sidebar, arrastar-e-soltar e impressao em lote ---
  const sidebar = useSidebarState();
  const drag = useInventoryDragController({
    activeView: navigation.activeView,
    data,
    inventory,
    moves,
    segmentMutations,
    sidebar
  });
  const bulkPrint = useBulkPrint({ selectedAssets: selection.selectedAssets });

  return {
    data,
    inventory,
    inventoryActions: {
      assets,
      backup,
      groups,
      maintenance: { ...maintenanceEntry, ...maintenanceExit },
      moves,
      peripherals,
      segments: { ...segmentForm, ...segmentMutations },
      tabs
    },
    layout: { bulkPrint, drag, sidebar },
    navigation,
    serviceOrders: { ...serviceOrderCore, ...backupFlow, ...lifecycle }
  };
}
