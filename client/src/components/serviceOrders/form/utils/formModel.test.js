import { describe, expect, it } from "vitest";
import {
  buildInitialForm,
  buildResetFields,
  buildSubmitPayload,
  getDeviceContext,
  resolveSector,
  toggleTechnician,
  validateServiceOrderForm
} from "./formModel.js";

const valid = {
  title: "Título",
  description: "d",
  requesterName: "r",
  category: "c",
  assetId: "a",
  businessMode: false,
  selectedClient: null
};

describe("formModel", () => {
  it("descreve o contexto do ativo por grupo e segmento", () => {
    expect(getDeviceContext({ groupName: "G", segmentName: "S" })).toBe("G / S");
    expect(getDeviceContext({ segmentGroupName: "G2", segment: { name: "S2" } })).toBe("G2 / S2");
    expect(getDeviceContext({ segmentGroup: "G3" })).toBe("G3");
    expect(getDeviceContext({ group: { name: "G4" } })).toBe("G4");
    expect(getDeviceContext({})).toBe("");
  });

  it("cria o formulário inicial e os campos de reinício", () => {
    expect(buildInitialForm({ autoPriority: { enabled: true } })).toMatchObject({
      autoPriorityEnabled: true,
      environmentId: "",
      sectorId: "sector-geral"
    });
    expect(buildInitialForm(undefined).autoPriorityEnabled).toBe(false);
    expect(buildResetFields({ businessMode: false, activeTab: { id: "t" }, serviceOrderSettings: {} }).environmentId).toBe("t");
    expect(buildResetFields({ businessMode: true, activeTab: { id: "t" }, serviceOrderSettings: {} }).environmentId).toBe("");
    expect(buildResetFields({ businessMode: false, activeTab: undefined, serviceOrderSettings: {} }).environmentId).toBe("");
  });

  it("alterna técnicos mantendo o primeiro como principal", () => {
    const first = toggleTechnician({ assignedTechnicianNames: undefined }, "A");
    expect(first).toMatchObject({ assignedTechnicianNames: ["A"], assignedTechnicianName: "A" });
    const second = toggleTechnician(first, "B");
    expect(second.assignedTechnicianNames).toEqual(["A", "B"]);
    expect(toggleTechnician(second, "A")).toMatchObject({ assignedTechnicianNames: ["B"], assignedTechnicianName: "B" });
    expect(toggleTechnician(first, "A")).toMatchObject({ assignedTechnicianNames: [], assignedTechnicianName: "" });
  });

  it("resolve o setor com queda para Geral e para o primeiro", () => {
    const sectors = [
      { id: "a", name: "A" },
      { id: "g", name: "Geral" }
    ];
    expect(resolveSector(sectors, "a").id).toBe("a");
    expect(resolveSector(sectors, "x").id).toBe("g");
    expect(resolveSector([{ id: "a", name: "A" }], "x").id).toBe("a");
  });

  it("valida o modo Local", () => {
    expect(validateServiceOrderForm(valid)).toBe("");
    expect(validateServiceOrderForm({ ...valid, title: "ab" })).toContain("3 caracteres");
    expect(validateServiceOrderForm({ ...valid, description: "" })).toContain("descrição, categoria e solicitante");
    expect(validateServiceOrderForm({ ...valid, category: "" })).toContain("descrição, categoria e solicitante");
    expect(validateServiceOrderForm({ ...valid, requesterName: "" })).toContain("descrição, categoria e solicitante");
  });

  it("valida o modo Business na ordem dos campos", () => {
    const business = { ...valid, businessMode: true, selectedClient: { id: "c" } };
    expect(validateServiceOrderForm(business)).toBe("");
    expect(validateServiceOrderForm({ ...business, selectedClient: undefined })).toContain("cliente");
    expect(validateServiceOrderForm({ ...business, assetId: "" })).toContain("máquina/ativo");
    expect(validateServiceOrderForm({ ...business, requesterName: "" })).toContain("solicitante");
    expect(validateServiceOrderForm({ ...business, category: "" })).toContain("categoria");
    expect(validateServiceOrderForm({ ...business, description: "" })).toContain("descreva");
  });

  it("monta o payload com setor e ambiente do modo", () => {
    const form = { priority: "low", assignedTechnicianNames: ["A", "B"], assetId: "a" };
    const fields = { title: "T", description: "D", requesterName: "R", category: "C" };
    const local = buildSubmitPayload({
      form,
      fields,
      businessMode: false,
      selectedClient: undefined,
      selectedEnvironment: { name: "Matriz" },
      selectedSector: { id: "s", name: "TI" }
    });
    expect(local).toMatchObject({
      title: "T",
      assignedTechnicianName: "A",
      notes: "",
      sectorId: "s",
      sectorName: "TI",
      environmentName: "Matriz"
    });
    const business = buildSubmitPayload({
      form,
      fields,
      businessMode: true,
      selectedClient: { legalName: "Razão" },
      selectedEnvironment: undefined,
      selectedSector: undefined
    });
    expect(business).toMatchObject({ environmentName: "Razão", sectorId: "sector-geral", sectorName: "Geral" });
    expect(
      buildSubmitPayload({
        form: { assignedTechnicianNames: [] },
        fields,
        businessMode: true,
        selectedClient: undefined,
        selectedEnvironment: undefined,
        selectedSector: undefined
      })
    ).toMatchObject({ environmentName: "", assignedTechnicianName: "" });
    expect(
      buildSubmitPayload({
        form: { assignedTechnicianNames: [] },
        fields,
        businessMode: false,
        selectedClient: undefined,
        selectedEnvironment: undefined,
        selectedSector: undefined
      }).environmentName
    ).toBe("");
  });
});
