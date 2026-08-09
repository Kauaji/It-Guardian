import assert from "node:assert/strict";
import test from "node:test";

import {
  consolidateSuggestionsByMachine,
  findSuggestionDevice,
  formatAlertValue,
  formatCompactSuggestionTitle,
  formatDisplayText,
  getDeviceDisplayName,
  normalizePrioritySettings
} from "../../client/src/components/alerts/alertUtils.js";
import { applyInventoryLocalState } from "../../client/src/components/inventory/inventoryLocalState.js";

const device = {
  id: "asset-1",
  name: "DESKTOP-8H8H73H",
  hostname: "DESKTOP-8H8H73H",
  displayName: "Computador do Kauã"
};

function suggestion(overrides = {}) {
  return {
    id: "suggestion-1",
    assetId: device.id,
    hostName: device.hostname,
    title: "Máquina offline em DESKTOP-8H8H73H",
    alertType: "machine_offline",
    suggestedPriority: "medium",
    occurrencesCount: 1,
    status: "pending",
    createdAt: "2026-07-29T12:00:00.000Z",
    updatedAt: "2026-07-29T12:00:00.000Z",
    ...overrides
  };
}

test("uses the fantasy name and falls back to the hostname", () => {
  assert.equal(getDeviceDisplayName(device), "Computador do Kauã");
  assert.equal(getDeviceDisplayName({ hostname: "PC-01" }), "PC-01");
});

test("formats structured alert data before rendering", () => {
  assert.equal(
    formatDisplayText({
      name: "Microsoft 365",
      version: "2021",
      installedAt: "2026-07-29T12:00:00.000Z",
      manufacturer: "Microsoft"
    }),
    "Microsoft 365 2021"
  );
  assert.equal(
    getDeviceDisplayName({
      displayName: { name: "Notebook Financeiro", version: "v2" },
      hostname: "NB-FIN-01"
    }),
    "Notebook Financeiro v2"
  );
  assert.equal(
    formatCompactSuggestionTitle(
      {
        problemLabels: [
          { name: "RAM alta" },
          { summary: "Disco alto" }
        ]
      },
      { name: "Computador do Kaua" }
    ),
    "RAM alta + Disco alto em Computador do Kaua"
  );
  assert.equal(
    formatAlertValue({
      metric: "software",
      value: {
        name: "Microsoft 365",
        version: "2021",
        installedAt: "2026-07-29T12:00:00.000Z",
        manufacturer: "Microsoft"
      }
    }),
    "Microsoft 365 2021"
  );
});

test("matches a suggestion to its device by stable identity", () => {
  assert.equal(findSuggestionDevice(suggestion(), [device]), device);
});

test("consolidates active problems into one machine card and escalates priority", () => {
  const consolidated = consolidateSuggestionsByMachine(
    [
      suggestion(),
      suggestion({
        id: "suggestion-2",
        title: "Disco acima do limite em DESKTOP-8H8H73H",
        alertType: "disk_high",
        suggestedPriority: "high"
      }),
      suggestion({
        id: "suggestion-3",
        title: "Memória RAM acima do limite em DESKTOP-8H8H73H",
        alertType: "ram_high",
        suggestedPriority: "high"
      })
    ],
    [device]
  );

  assert.equal(consolidated.length, 1);
  assert.equal(consolidated[0].machineAlias, "Computador do Kauã");
  assert.equal(consolidated[0].problemCount, 3);
  assert.equal(consolidated[0].suggestedPriority, "critical");
  assert.match(consolidated[0].title, /Computador do Kauã/);
});

test("recalculates the consolidated card when a problem is no longer active", () => {
  const remaining = consolidateSuggestionsByMachine(
    [
      suggestion({
        id: "suggestion-2",
        title: "Disco acima do limite em DESKTOP-8H8H73H",
        alertType: "disk_high",
        suggestedPriority: "high"
      })
    ],
    [device]
  );

  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].problemCount, 1);
  assert.equal(remaining[0].suggestedPriority, "high");
  assert.deepEqual(remaining[0].memberSuggestionIds, ["suggestion-2"]);
});

test("keeps the automatic alert expiration at 48 hours by default", () => {
  assert.equal(normalizePrioritySettings().inactiveAlertAutoResolveHours, 48);
  assert.equal(
    normalizePrioritySettings({ inactiveAlertAutoResolveHours: 72 }).inactiveAlertAutoResolveHours,
    72
  );
});

test("shows only manually registered peripherals while preserving collected data", () => {
  const collectedPeripheral = {
    id: "collected-1",
    type: "Monitor",
    brand: "Coletado"
  };
  const manualPeripheral = {
    id: "manual-1",
    type: "Teclado",
    brand: "Cadastrado pelo usuário"
  };
  const [result] = applyInventoryLocalState(
    [
      {
        ...device,
        hardware: {
          peripherals: [collectedPeripheral]
        }
      }
    ],
    {},
    {},
    {},
    {
      [device.id]: [manualPeripheral]
    }
  );

  assert.deepEqual(result.hardware.peripherals, [manualPeripheral]);
  assert.deepEqual(result.hardware.collectedPeripherals, [collectedPeripheral]);
});
