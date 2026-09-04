import test from "node:test";
import assert from "node:assert/strict";
import { collectHardwareParts } from "./hardwarePartInventory.js";

test("transforma hardware coletado em peças usadas com identidade estável", () => {
  const asset = { asset_id: "asset-1", cpu_model: "Intel Core i5", inventory_details: { memoryHealth: { moduleDetails: [{ manufacturer: "Kingston", partNumber: "K16", serialNumber: "ABC", capacityGb: 16 }] }, disks: [{ name: "SSD NVMe", serialNumber: "SSD-1" }], networkAdapters: [{ name: "Intel Ethernet", macAddress: "00:11:22:33:44:55" }] } };
  const first = collectHardwareParts(asset);
  const second = collectHardwareParts(asset);
  assert.equal(first.length, 3);
  assert.equal(first[1].category, "Memória");
  assert.equal(first[1].hardwareKey, second[1].hardwareKey);
  assert.equal(first.some((part) => part.category === "Rede"), false);
});

test("mantém somente hardware físico relevante e segmenta periféricos", () => {
  const parts = collectHardwareParts({
    asset_id: "asset-physical",
    inventory_details: {
      graphics: [{ name: "AMD Radeon RX 6600" }, { name: "Parsec Virtual Display Adapter" }],
      networkAdapters: [{ name: "Realtek PCIe GbE Family Controller" }],
      peripherals: [
        { name: "USB Optical Mouse" },
        { name: "Standard PS/2 Keyboard" },
        { name: "Virtual Audio Driver" }
      ],
      powerSupply: { name: "Corsair CX550" }
    }
  });

  assert.deepEqual(parts.map((part) => part.category), ["Placa de vídeo", "Fonte", "Mouse", "Teclado"]);
  assert.equal(parts.some((part) => /Parsec|Realtek|Driver/i.test(part.name)), false);
});
