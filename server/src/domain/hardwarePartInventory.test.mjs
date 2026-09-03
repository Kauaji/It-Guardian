import test from "node:test";
import assert from "node:assert/strict";
import { collectHardwareParts } from "./hardwarePartInventory.js";

test("transforma hardware coletado em peças usadas com identidade estável", () => {
  const asset = { asset_id: "asset-1", cpu_model: "Intel Core i5", inventory_details: { memoryHealth: { moduleDetails: [{ manufacturer: "Kingston", partNumber: "K16", serialNumber: "ABC", capacityGb: 16 }] }, disks: [{ name: "SSD NVMe", serialNumber: "SSD-1" }], networkAdapters: [{ name: "Intel Ethernet", macAddress: "00:11:22:33:44:55" }] } };
  const first = collectHardwareParts(asset);
  const second = collectHardwareParts(asset);
  assert.equal(first.length, 4);
  assert.equal(first[1].category, "Memória");
  assert.equal(first[1].hardwareKey, second[1].hardwareKey);
  assert.equal(first[3].macAddress, "00:11:22:33:44:55");
});
