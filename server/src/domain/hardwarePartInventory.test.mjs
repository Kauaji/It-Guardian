import test from "node:test";
import assert from "node:assert/strict";
import { collectHardwareParts, isSupportedPhysicalPartRecord } from "./hardwarePartInventory.js";

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
      graphics: [{ name: "AMD Radeon RX 6600" }, { name: "Parsec Virtual Display Adapter" }, { name: "Microsoft Basic Display Adapter" }],
      networkAdapters: [{ name: "Realtek PCIe GbE Family Controller" }],
      peripherals: [
        { name: "Logitech USB Optical Mouse", type: "Mouse", brand: "Logitech" },
        { name: "Keychron K2 Keyboard", type: "Teclado", brand: "Keychron" },
        { name: "HID-compliant mouse", type: "Mouse" },
        { name: "Standard PS/2 Keyboard", type: "Teclado" },
        { name: "Generic PnP Monitor", type: "Monitor" },
        { name: "Virtual Audio Driver" }
      ],
      powerSupply: { name: "Corsair CX550" }
    }
  });

  assert.deepEqual(parts.map((part) => part.category), ["Placa de vídeo", "Fonte", "Mouse", "Teclado"]);
  assert.equal(parts.some((part) => /Parsec|Realtek|Driver|HID-compliant|Standard PS\/2|Generic PnP/i.test(part.name)), false);
});

test("rejeita discos virtuais e reconhece registros antigos que devem ser limpos", () => {
  const parts = collectHardwareParts({
    asset_id: "asset-storage",
    inventory_details: {
      disks: [{ name: "KINGSTON SNV2S1000G" }, { name: "Microsoft Storage Space Device" }, { name: "QEMU Virtual Disk" }]
    }
  });
  assert.deepEqual(parts.map((part) => part.name), ["KINGSTON SNV2S1000G"]);
  assert.equal(isSupportedPhysicalPartRecord({ name: "HID-compliant mouse", category: "Mouse", metadata: { hardwareType: "mouse", collectedValue: { name: "HID-compliant mouse", type: "Mouse" } } }), false);
  assert.equal(isSupportedPhysicalPartRecord({ name: "Logitech M90", category: "Mouse", metadata: { hardwareType: "mouse", collectedValue: { name: "Logitech M90", type: "Mouse" } } }), true);
});
