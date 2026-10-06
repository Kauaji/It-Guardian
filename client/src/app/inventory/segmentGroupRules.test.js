import { describe, expect, it } from "vitest";
import { countSegmentsInGroup, deleteGroupConfirmation, hasDuplicateGroupName } from "./segmentGroupRules.js";

describe("segmentGroupRules", () => {
  const groups = [{ id: "g1", name: "Andar 1" }, { id: "g2", name: " Andar 2 " }];

  it("hasDuplicateGroupName ignora caixa, espacos e o proprio grupo", () => {
    expect(hasDuplicateGroupName(groups, "andar 1", undefined)).toBe(true);
    expect(hasDuplicateGroupName(groups, "ANDAR 2", undefined)).toBe(true);
    expect(hasDuplicateGroupName(groups, "Andar 1", "g1")).toBe(false);
    expect(hasDuplicateGroupName(groups, "Novo", undefined)).toBe(false);
  });

  it("countSegmentsInGroup conta os segmentos do grupo", () => {
    const segments = [{ id: "s1", groupId: "g1" }, { id: "s2", groupId: "g1" }, { id: "s3", groupId: "g2" }];
    expect(countSegmentsInGroup(segments, groups, "g1")).toBe(2);
    expect(countSegmentsInGroup(segments, groups, "g9")).toBe(0);
  });

  it("deleteGroupConfirmation cita os segmentos movidos quando ha", () => {
    expect(deleteGroupConfirmation({ name: "A" }, 0)).toBe('Excluir o grupo "A"?');
    expect(deleteGroupConfirmation({ name: "A" }, 3)).toBe('Excluir o grupo "A" e mover 3 segmento(s) para Sem grupo?');
  });
});
