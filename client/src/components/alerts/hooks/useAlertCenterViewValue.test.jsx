import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useAlertCenterViewValue from "./useAlertCenterViewValue.js";

const inventory = { devices: [{ id: "d1", name: "PC-01" }], segments: [], segmentGroups: [], inventoryTabs: [] };

describe("useAlertCenterViewValue", () => {
  it("combina permissões e resolvedores de inventário", () => {
    const can = (permission) => permission === "alerts.view";
    const { result } = renderHook(() => useAlertCenterViewValue({ can, remoteScriptExecutionEnabled: true, inventory }));

    expect(result.current.perms.canViewAlerts).toBe(true);
    expect(result.current.perms.canViewScripts).toBe(false);
    expect(result.current.perms.remoteScriptExecutionEnabled).toBe(true);
    expect(result.current.lookups.findAlertDevice({ assetId: "d1" })).toBe(inventory.devices[0]);
  });

  it("mantém o mesmo valor enquanto as entradas não mudam e recalcula quando mudam", () => {
    const can = () => true;
    const { result, rerender } = renderHook((props) => useAlertCenterViewValue(props), {
      initialProps: { can, remoteScriptExecutionEnabled: false, inventory }
    });
    const first = result.current;

    rerender({ can, remoteScriptExecutionEnabled: false, inventory });
    expect(result.current).toBe(first);

    rerender({ can, remoteScriptExecutionEnabled: true, inventory });
    expect(result.current).not.toBe(first);
    expect(result.current.perms.canUseScriptsFromAlerts).toBe(true);
  });
});
