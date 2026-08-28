import { describe, expect, it } from "vitest";
import { buildInventoryBoardSections, getOccupiedInventorySegmentIds } from "./inventoryBoardSections.js";

const maintenance = { id: "maintenance", name: "Manutenção", color: "#f59e0b" };
const regular = { id: "regular", name: "Escritório" };
const maintenanceMachine = { id: "d1", segmentId: maintenance.id };
const occupiedMaintenance = new Map([[maintenance.id, [maintenanceMachine]]]);

describe("buildInventoryBoardSections", () => {
  it.each(["Manutenção", "Manutencao", " manutenção ".toUpperCase()])("separa %s de Sem grupo", (name) => {
    const segment = { ...maintenance, name };
    const sections = buildInventoryBoardSections({ segments: [segment, regular], machinesBySegment: occupiedMaintenance });

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

    const sections = buildInventoryBoardSections({ segments: [segment, regular], groups: [group], machinesBySegment: occupiedMaintenance });

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
    const sections = buildInventoryBoardSections({ segments: [maintenance], groups, machinesBySegment: occupiedMaintenance });

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
      machinesBySegment: occupiedMaintenance,
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
      machinesBySegment: occupiedMaintenance,
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
      machinesBySegment: occupiedMaintenance,
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
      machinesBySegment: occupiedMaintenance,
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
      machinesBySegment: new Map([
        [maintenance.id, [maintenanceMachine]],
        [anotherMaintenance.id, [{ id: "d2", segmentId: anotherMaintenance.id }]]
      ]),
      groups: [{ id: "g1", segmentIds: [anotherMaintenance.id] }]
    });

    expect(sections.standaloneSegments).toEqual([maintenance, anotherMaintenance]);
    expect(sections.standaloneSegments[1]).toBe(anotherMaintenance);
    expect(sections.groupedSections[0].segments).toEqual([]);
    expect(sections.ungroupedSegments).toEqual([]);
  });

  it("oculta manutenção realmente vazia mesmo com machineCount desatualizado", () => {
    const staleSegment = Object.freeze({ ...maintenance, machineCount: 3, groupId: "g1" });
    const sections = buildInventoryBoardSections({
      segments: [staleSegment, regular],
      devices: [],
      groups: [{ id: "g1", segmentIds: [staleSegment.id] }],
      machinesBySegment: occupiedMaintenance
    });

    expect(sections.standaloneSegments).toEqual([]);
    expect(sections.availableSegments).toEqual([regular]);
    expect(sections.groupedSections[0].segments).toEqual([]);
    expect(staleSegment.machineCount).toBe(3);
    expect(staleSegment.groupId).toBe("g1");
  });

  it("uma seleção antiga não força a manutenção vazia a continuar aparecendo", () => {
    const sections = buildInventoryBoardSections({
      segments: [maintenance, regular],
      machinesBySegment: new Map(),
      selectedSegmentId: maintenance.id
    });

    expect(sections.standaloneSegments).toEqual([]);
    expect(sections.availableSegments).toEqual([regular]);
  });

  it("mantém o segmento ocupado nos filtros quando a busca não encontra suas máquinas", () => {
    const sections = buildInventoryBoardSections({
      segments: [maintenance, regular],
      devices: [maintenanceMachine],
      machinesBySegment: new Map(),
      search: "não corresponde"
    });

    expect(sections.availableSegments).toEqual([maintenance, regular]);
    expect(sections.standaloneSegments).toEqual([]);
  });

  it("oculta depois que a última máquina volta à origem e reaparece quando ela entra novamente", () => {
    const segment = Object.freeze({ ...maintenance, machineCount: 1 });
    const record = Object.freeze({ origin: Object.freeze({ segmentId: regular.id }), reason: "repair" });
    const repairing = Object.freeze({ ...maintenanceMachine, maintenance: true, maintenanceOrigin: record.origin });
    const source = Object.freeze([segment, regular]);
    const inMaintenance = buildInventoryBoardSections({ segments: source, devices: [repairing] });
    const returned = buildInventoryBoardSections({
      segments: source,
      devices: [{ ...repairing, segmentId: regular.id, maintenance: false }]
    });
    const backInMaintenance = buildInventoryBoardSections({ segments: source, devices: [repairing] });

    expect(inMaintenance.standaloneSegments).toEqual([segment]);
    expect(returned.standaloneSegments).toEqual([]);
    expect(returned.ungroupedSegments).toEqual([regular]);
    expect(backInMaintenance.standaloneSegments[0]).toBe(segment);
    expect(source).toEqual([segment, regular]);
    expect(record.origin.segmentId).toBe(regular.id);
    expect(repairing.maintenanceOrigin).toBe(record.origin);
  });

  it("usa o vínculo atual por ID, não flags ou nomes antigos na máquina", () => {
    const sections = buildInventoryBoardSections({
      segments: [maintenance, regular],
      devices: [{ id: "returned", segmentId: regular.id, maintenance: true, segmentName: maintenance.name }]
    });
    expect(sections.standaloneSegments).toEqual([]);
    const occupied = buildInventoryBoardSections({
      segments: [maintenance, regular],
      devices: [{ id: "new", segmentId: maintenance.id, maintenance: false, segmentName: regular.name }]
    });
    expect(occupied.standaloneSegments).toEqual([maintenance]);
  });

  it("não oculta segmentos comuns ou padrão vazios nem outras manutenções ocupadas", () => {
    const emptyLegacy = { ...maintenance, id: "empty-maintenance", groupId: "old" };
    const defaultSegment = { id: "default", name: "Não organizadas", isDefault: true };
    const preventive = { id: "preventive", name: "Manutenção preventiva" };
    const sections = buildInventoryBoardSections({
      segments: [maintenance, emptyLegacy, regular, defaultSegment, preventive],
      devices: [maintenanceMachine]
    });
    expect(sections.availableSegments).toEqual([maintenance, regular, defaultSegment, preventive]);
    expect(sections.standaloneSegments).toEqual([maintenance, defaultSegment]);
    expect(sections.ungroupedSegments).toEqual([regular, preventive]);
  });
});

describe("getOccupiedInventorySegmentIds", () => {
  it("considera o inventário real antes dos filtros e elimina IDs ausentes ou repetidos", () => {
    const occupied = getOccupiedInventorySegmentIds({
      devices: [maintenanceMachine, { id: "d2", segmentId: maintenance.id }, { id: "d3" }],
      machinesBySegment: new Map()
    });
    expect([...occupied]).toEqual([maintenance.id]);
  });

  it("não usa uma contagem filtrada antiga quando a lista real está vazia", () => {
    expect(getOccupiedInventorySegmentIds({ devices: [], machinesBySegment: occupiedMaintenance }).size).toBe(0);
  });

  it("usa a distribuição de máquinas quando o componente não recebe inventário bruto", () => {
    expect([...getOccupiedInventorySegmentIds({
      machinesBySegment: new Map([[maintenance.id, [maintenanceMachine]], [regular.id, []]])
    })]).toEqual([maintenance.id]);
    expect(getOccupiedInventorySegmentIds().size).toBe(0);
  });
});
