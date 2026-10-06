import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderCell } from "./settingsCells.jsx";
import { buildProblemCategories, configs, emptyRecord, visibleByMode } from "./settingsConfigs.js";
import { filterRecords, importSummary } from "./useSettingsRecords.js";

describe("settingsConfigs", () => {
  it("emptyRecord inicializa status, numeros, multiplos e textos", () => {
    expect(emptyRecord(configs.clients).active).toBe(true);
    expect(emptyRecord(configs.clients).tradeName).toBe("");
    expect(emptyRecord(configs.products).quantity).toBe(0);
    expect(emptyRecord(configs.technicians).allowedClientIds).toEqual([]);
  });

  it("visibleByMode respeita businessOnly e internalOnly", () => {
    const items = [{ k: "a" }, { k: "b", businessOnly: true }, { k: "c", internalOnly: true }];
    expect(visibleByMode(items, false).map((i) => i.k)).toEqual(["a", "c"]);
    expect(visibleByMode(items, true).map((i) => i.k)).toEqual(["a", "b"]);
  });

  it("buildProblemCategories junta as base com as dos registros sem duplicar", () => {
    const result = buildProblemCategories([{ category: "Telefonia" }, { category: "Rede" }, {}]);
    expect(result).toContain("Telefonia");
    expect(result.filter((c) => c === "Rede")).toHaveLength(1);
    expect(buildProblemCategories()).toHaveLength(10);
  });
});

describe("useSettingsRecords helpers", () => {
  const records = [
    { id: 1, name: "Alfa", note: null },
    { id: 2, name: "Beta", note: "Zeta" }
  ];

  it("filterRecords ignora caixa, espacos e valores vazios", () => {
    expect(filterRecords(records, "  ")).toBe(records);
    expect(filterRecords(records, "ZET")).toEqual([records[1]]);
    expect(filterRecords(records, "nada")).toEqual([]);
  });

  it("importSummary escolhe o tom pelo numero de erros", () => {
    expect(importSummary({ imported: 2 })).toEqual({ message: "2 registros importados. 0 erros.", type: "ok" });
    expect(importSummary({ imported: 2, errors: ["x", "y"] })).toEqual({ message: "2 registros importados. 2 erros.", type: "danger" });
  });
});

describe("renderCell", () => {
  const cell = (record, column) => render(<div>{renderCell(record, column)}</div>).container.textContent;

  it("formata status, prioridade, tipo de regra, moeda e texto", () => {
    expect(cell({ a: true }, { key: "a", type: "status" })).toBe("Ativo");
    expect(cell({ a: false }, { key: "a", type: "status" })).toBe("Inativo");
    expect(cell({ a: "high" }, { key: "a", type: "priority" })).toBe("Alta");
    expect(cell({ a: "zzz" }, { key: "a", type: "priority" })).toBe("Não definida");
    expect(cell({ a: "sector" }, { key: "a", type: "ruleType" })).toBe("Prioridade por setor");
    expect(cell({ a: "outro" }, { key: "a", type: "ruleType" })).toBe("outro");
    expect(cell({}, { key: "a", type: "ruleType" })).toBe("Não informado");
    expect(cell({ a: 12.5 }, { key: "a", type: "currency" })).toMatch(/R\$\s12,50/);
    expect(cell({ a: "x" }, { key: "a" })).toBe("x");
    expect(cell({}, { key: "a" })).toBe("Não informado");
  });
});
