import { describe, expect, it } from "vitest";
import { buildInventoryBoardSections } from "./inventoryBoardSections.js";

const maintenance = { id: "maintenance", name: "Manutenção", color: "#f59e0b" };
const regular = { id: "regular", name: "Escritório" };

describe("buildInventoryBoardSections", () => {
  it.each(["Manutenção", "Manutencao", " manutenção ".toUpperCase()])("separa %s de Sem grupo", (name) => {
    const segment = { ...maintenance, name };
    const sections = buildInventoryBoardSections({ segments: [segment, regular] });

    expect(sections.ungroupedSegments).toEqual([regular]);
    expect(sections.standaloneSegments).toEqual([segment]);
    expect(sections.groupedSections).toEqual([]);
  });

  it.each(["groupId", "segmentIds"])("ignora o vínculo legado %s apenas na apresentação", (binding) => {
    const segment = Object.freeze({ ...maintenance, ...(binding === "groupId" ? { groupId: "g1" } : {}) });
    const group = Object.freeze({
      id: "g1",
      name: "Sala",
      segmentIds: Object.freeze(binding === "segmentIds" ? [segment.id, regular.id] : [regular.id])
    });

    const sections = buildInventoryBoardSections({ segments: [segment, regular], groups: [group] });

    expect(sections.groupedSections[0].segments).toEqual([regular]);
    expect(sections.ungroupedSegments).toEqual([]);
    expect(sections.standaloneSegments[0]).toBe(segment);
    expect(sections.groupedSections[0].segmentIds).toBe(group.segmentIds);
  });

  it("mantém grupos vazios disponíveis sem contar a manutenção", () => {
    const groups = [
      { id: "legacy", name: "Origem", segmentIds: [maintenance.id] },
      { id: "empty", name: "Novo grupo", segmentIds: [] }
    ];
    const sections = buildInventoryBoardSections({ segments: [maintenance], groups });

    expect(sections.groupedSections.map((group) => [group.id, group.segments.length])).toEqual([
      ["legacy", 0],
      ["empty", 0]
    ]);
    expect(sections.standaloneSegments).toEqual([maintenance]);
  });

  it("não transforma um segmento comum de manutenção preventiva em segmento especial", () => {
    const segment = { id: "preventive", name: "Manutenção preventiva", groupId: "g1" };
    const sections = buildInventoryBoardSections({ segments: [segment], groups: [{ id: "g1" }] });

    expect(sections.groupedSections[0].segments).toEqual([segment]);
    expect(sections.standaloneSegments).toEqual([]);
  });

  it("não duplica segmentos padrão com vínculos legados", () => {
    const defaultSegment = { id: "default", name: "Não organizadas", isDefault: true, groupId: "g1" };
    const sections = buildInventoryBoardSections({
      segments: [defaultSegment, maintenance],
      groups: [{ id: "g1", segmentIds: [defaultSegment.id, maintenance.id] }]
    });

    expect(sections.groupedSections[0].segments).toEqual([]);
    expect(sections.ungroupedSegments).toEqual([]);
    expect(sections.standaloneSegments).toEqual([maintenance, defaultSegment]);
  });

  it("o filtro de um grupo não inclui sua manutenção legada", () => {
    const segment = { ...maintenance, groupId: "g1" };
    const sections = buildInventoryBoardSections({
      segments: [segment, regular],
      groups: [{ id: "g1", segmentIds: [segment.id, regular.id] }],
      selectedGroupId: "g1"
    });

    expect(sections.groupedSections[0].segments).toEqual([regular]);
    expect(sections.standaloneSegments).toEqual([]);
  });

  it("mantém a manutenção independente ao usar Sem grupo", () => {
    const segment = { ...maintenance, groupId: "legacy" };
    const sections = buildInventoryBoardSections({
      segments: [segment, regular],
      groups: [{ id: "legacy" }],
      selectedGroupId: "ungrouped"
    });

    expect(sections.ungroupedSegments).toEqual([regular]);
    expect(sections.standaloneSegments).toEqual([segment]);
    expect(sections.groupedSections).toEqual([]);
  });

  it("permite selecionar diretamente a manutenção mesmo com o grupo legado selecionado", () => {
    const segment = { ...maintenance, groupId: "g1" };
    const sections = buildInventoryBoardSections({
      segments: [segment, regular],
      groups: [{ id: "g1", segmentIds: [regular.id] }],
      selectedGroupId: "g1",
      selectedSegmentId: segment.id
    });

    expect(sections.standaloneSegments).toEqual([segment]);
    expect(sections.groupedSections).toEqual([]);
    expect(sections.ungroupedSegments).toEqual([]);
  });

  it("busca mostra apenas segmentos com máquinas correspondentes", () => {
    const sections = buildInventoryBoardSections({
      segments: [maintenance, regular],
      groups: [{ id: "empty" }],
      search: "computador",
      machinesBySegment: new Map([[maintenance.id, [{ id: "d1" }]]])
    });

    expect(sections.standaloneSegments).toEqual([maintenance]);
    expect(sections.ungroupedSegments).toEqual([]);
    expect(sections.groupedSections).toEqual([]);
  });

  it("não recria segmentos de outro ambiente a partir das máquinas ou dos vínculos", () => {
    const sections = buildInventoryBoardSections({
      segments: [regular],
      groups: [{ id: "g1", segmentIds: [maintenance.id] }],
      machinesBySegment: new Map([[maintenance.id, [{ id: "other-environment" }]]])
    });

    expect(sections.standaloneSegments).toEqual([]);
    expect(sections.ungroupedSegments).toEqual([regular]);
    expect(sections.groupedSections[0].segments).toEqual([]);
  });

  it("não consolida IDs distintos de manutenção nem altera seu histórico de origem", () => {
    const anotherMaintenance = { ...maintenance, id: "maintenance-legacy", groupId: "g1" };
    const sections = buildInventoryBoardSections({
      segments: [maintenance, anotherMaintenance],
      groups: [{ id: "g1", segmentIds: [anotherMaintenance.id] }]
    });

    expect(sections.standaloneSegments).toEqual([maintenance, anotherMaintenance]);
    expect(sections.standaloneSegments[1]).toBe(anotherMaintenance);
    expect(sections.groupedSections[0].segments).toEqual([]);
    expect(sections.ungroupedSegments).toEqual([]);
  });
});
