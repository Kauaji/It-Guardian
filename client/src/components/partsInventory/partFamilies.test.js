import { describe, expect, it } from "vitest";
import { buildComputerKits, groupPartsByFamily, resolvePartFamily } from "./partFamilies.js";

describe("famílias do inventário de peças", () => {
  it("organiza os componentes principais em famílias técnicas", () => {
    expect(resolvePartFamily({ category: "Placa-mãe", name: "B550M" }).id).toBe("motherboard");
    expect(resolvePartFamily({ category: "Vídeo", name: "AMD Radeon RX 6600" }).id).toBe("graphics");
    expect(resolvePartFamily({ category: "Armazenamento", name: "SSD NVMe" }).id).toBe("storage");
  });

  it("separa periféricos reconhecidos e leva o restante para diversos", () => {
    expect(resolvePartFamily({ category: "Periféricos", name: "USB Mouse" }).id).toBe("mouse");
    expect(resolvePartFamily({ category: "Periféricos", name: "Standard PS/2 Keyboard" }).id).toBe("keyboard");
    expect(resolvePartFamily({ category: "Periféricos", name: "Webcam Full HD" }).id).toBe("misc");
  });

  it("agrupa peças e monta kits somente com componentes instalados", () => {
    const parts = [
      { id: "ram", category: "Memória", inventoryState: "in_use", sourceAssetId: "asset-1" },
      { id: "ssd", category: "Armazenamento", inventoryState: "in_use", assignedAssetId: "asset-1" },
      { id: "stock", category: "Fonte", inventoryState: "available" }
    ];
    expect(groupPartsByFamily(parts).map((group) => group.id)).toEqual(["memory", "storage", "power"]);
    expect(buildComputerKits(parts, [{ id: "asset-1", alias: "PC Financeiro" }])).toEqual([
      expect.objectContaining({ assetId: "asset-1", name: "PC Financeiro", parts: [parts[0], parts[1]] })
    ]);
  });
});
