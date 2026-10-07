import { useMemo } from "react";
import { createAlertLookups } from "../alertLookups.js";
import { buildAlertCenterPermissions } from "../alertPermissions.js";

// Valor do contexto focado da Central: permissoes e resolvedores de inventario.
export default function useAlertCenterViewValue({ can, remoteScriptExecutionEnabled, inventory }) {
  const { devices, segments, segmentGroups, inventoryTabs } = inventory;
  const perms = useMemo(() => buildAlertCenterPermissions(can, remoteScriptExecutionEnabled), [can, remoteScriptExecutionEnabled]);
  const lookups = useMemo(
    () => createAlertLookups({ devices, segments, segmentGroups, inventoryTabs }),
    [devices, segments, segmentGroups, inventoryTabs]
  );

  return useMemo(() => ({ perms, lookups }), [perms, lookups]);
}
