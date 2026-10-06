import { beforeEach, describe, expect, it } from "vitest";
import {
  buildInitialForm,
  buildRelatedAssetText,
  fallbackCategories,
  fallbackProblemTypes,
  findProblemType,
  getFirstProblemTypeForCategory,
  readMachineContext,
  reconcileFormWithOptions,
  resolveSupportOptions
} from "./publicSupportModel.js";

describe("publicSupportModel", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/chamado");
  });

  it("findProblemType procura por nome ou id", () => {
    expect(findProblemType(fallbackProblemTypes, "printer").name).toBe("Impressora não imprime");
    expect(findProblemType(fallbackProblemTypes, "Internet lenta").id).toBe("network");
    expect(findProblemType(fallbackProblemTypes, "nada")).toBeUndefined();
  });

  it("getFirstProblemTypeForCategory aceita tipos sem categoria e cai no primeiro", () => {
    const list = [{ name: "A", category: "X" }, { name: "B" }, { name: "C", category: "Y" }];
    expect(getFirstProblemTypeForCategory(list, "Y").name).toBe("B");
    expect(getFirstProblemTypeForCategory([{ name: "A", category: "X" }], "Z").name).toBe("A");
  });

  it("readMachineContext prioriza a URL, depois o armazenamento local", () => {
    localStorage.setItem("it_guardian_machine_name", "Guardada");
    localStorage.setItem("it_guardian_asset_tag", "TAG");
    expect(readMachineContext()).toEqual({ deviceToken: "", machineName: "Guardada", assetTag: "TAG", environmentName: "" });
    window.history.pushState({}, "", "/chamado?device=d&machine=M&patrimonio=P&ambiente=E");
    expect(readMachineContext()).toEqual({ deviceToken: "d", machineName: "M", assetTag: "P", environmentName: "E" });
  });

  it("buildRelatedAssetText junta apenas o que foi informado", () => {
    expect(buildRelatedAssetText({})).toBe("");
    expect(buildRelatedAssetText({ machineName: "PC", location: "Sala" })).toBe("Nome da máquina: PC | Localização: Sala");
  });

  it("buildInitialForm usa o contexto e o ambiente padrao", () => {
    const form = buildInitialForm({ deviceToken: "t", machineName: "M", assetTag: "A", environmentName: "" });
    expect(form).toMatchObject({ category: fallbackCategories[0], problemType: fallbackProblemTypes[0].name, environmentName: "Não identificado", deviceToken: "t", website: "" });
    expect(buildInitialForm({ environmentName: "Env" }).environmentName).toBe("Env");
  });

  it("resolveSupportOptions usa o padrao para listas vazias e normaliza o modo", () => {
    expect(resolveSupportOptions({})).toEqual({ categories: fallbackCategories, problemTypes: fallbackProblemTypes, systemMode: "local" });
    expect(resolveSupportOptions({ categories: ["X"], problemTypes: [{ name: "P" }], systemMode: "business" })).toEqual({
      categories: ["X"], problemTypes: [{ name: "P" }], systemMode: "business"
    });
  });

  it("reconcileFormWithOptions corrige categoria e problema invalidos", () => {
    const problems = [{ name: "P1", category: "A" }, { name: "P2", category: "B" }];
    expect(reconcileFormWithOptions({ category: "Z", problemType: "?" }, ["A", "B"], problems)).toMatchObject({ category: "A", problemType: "P1" });
    expect(reconcileFormWithOptions({ category: "B", problemType: "P2" }, ["A", "B"], problems)).toMatchObject({ category: "B", problemType: "P2" });
    expect(reconcileFormWithOptions({ category: "B", problemType: "?" }, ["A", "B"], problems).problemType).toBe("P2");
    expect(reconcileFormWithOptions({ category: "B", problemType: "?" }, [], [])).toMatchObject({ category: "", problemType: "" });
  });
});
