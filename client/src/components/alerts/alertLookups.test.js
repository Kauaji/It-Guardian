import { describe, expect, it } from "vitest";
import { createAlertLookups } from "./alertLookups.js";

const devices = [
  { id: "d1", name: "PC-01", displayName: "Computador da Ana", segmentId: "s1", tabId: "t9" },
  { id: "d2", hostname: "SRV-02", segmentId: "s2", segmentGroupId: "g1" },
  { id: "d3", name: "Solta", segmentName: "Legado", tabName: "Aba antiga" },
  { id: "d4", name: "Ambiente", environment: "Homologação" }
];
const segments = [{ id: "s1", name: "Recepção", groupId: "g1", tabId: "t1" }, { id: "s2", name: "Servidores" }];
const segmentGroups = [{ id: "g1", name: "Matriz", tabId: "t2" }];
const inventoryTabs = [{ id: "t1", name: "Ambiente 1" }, { id: "t2", name: "Ambiente 2" }, { id: "t9", name: "Ambiente 9" }];

const lookups = createAlertLookups({ devices, segments, segmentGroups, inventoryTabs });

describe("createAlertLookups - dispositivos", () => {
  it("encontra o dispositivo do aviso por id, host ou nome normalizado", () => {
    expect(lookups.findAlertDevice({ assetId: "d2" })).toBe(devices[1]);
    expect(lookups.findAlertDevice({ hostId: "d1" })).toBe(devices[0]);
    expect(lookups.findAlertDevice({ hostName: "d3" })).toBe(devices[2]);
    expect(lookups.findAlertDevice({ hostName: "  srv-02" })).toBeNull();
    expect(lookups.findAlertDevice({ hostName: "SRV-02" })).toBe(devices[1]);
    expect(lookups.findAlertDevice({ hostName: "Computador da Ana" })).toBe(devices[0]);
    expect(lookups.findAlertDevice({ hostName: "inexistente" })).toBeNull();
  });

  it("encontra o dispositivo da sugestão pelos identificadores disponíveis", () => {
    expect(lookups.findSuggestionDevice({ assetId: "d1" })).toBe(devices[0]);
    expect(lookups.findSuggestionDevice({ hostName: "srv-02" })).toBe(devices[1]);
    expect(lookups.findSuggestionDevice({ assetId: "nenhum" })).toBeNull();
  });

  it("funciona sem listas", () => {
    const empty = createAlertLookups();

    expect(empty.findAlertDevice({ assetId: "x" })).toBeNull();
    expect(empty.getDevicePreventiveLocation({})).toEqual({
      tabName: "Ambiente atual",
      groupName: "Sem grupo",
      segmentName: "Não organizadas",
      segmentId: "unorganized"
    });
  });
});

describe("createAlertLookups - localização", () => {
  it("resolve segmento e grupo do dispositivo do aviso", () => {
    expect(lookups.getAlertLocation({ assetId: "d1" })).toEqual({ segmentName: "Recepção", groupName: "Matriz" });
    expect(lookups.getAlertLocation({ assetId: "d2" })).toEqual({ segmentName: "Servidores", groupName: "Matriz" });
    expect(lookups.getAlertLocation({ assetId: "d3" })).toEqual({ segmentName: "Legado", groupName: "Sem grupo" });
    expect(lookups.getAlertLocation({ assetId: "nenhum" })).toEqual({ segmentName: "Não organizadas", groupName: "Sem grupo" });
  });

  it("resolve a localização da sugestão", () => {
    expect(lookups.getSuggestionLocation({ assetId: "d1" })).toEqual({ segmentName: "Recepção", groupName: "Matriz" });
  });

  it("resolve aba, grupo e segmento para a lista preventiva", () => {
    expect(lookups.getDevicePreventiveLocation(devices[0])).toEqual({
      tabName: "Ambiente 9",
      groupName: "Matriz",
      segmentName: "Recepção",
      segmentId: "s1"
    });
    expect(lookups.getDevicePreventiveLocation(devices[1])).toEqual({
      tabName: "Ambiente 2",
      groupName: "Matriz",
      segmentName: "Servidores",
      segmentId: "s2"
    });
    expect(lookups.getDevicePreventiveLocation(devices[2])).toMatchObject({ tabName: "Aba antiga", segmentName: "Legado", segmentId: "unorganized" });
    expect(lookups.getDevicePreventiveLocation(devices[3]).tabName).toBe("Homologação");
  });
});

describe("createAlertLookups - rótulos", () => {
  it("usa o nome de exibição do dispositivo ou o host do aviso", () => {
    expect(lookups.getAlertMachineLabel({ assetId: "d1" })).toBe("Computador da Ana");
    expect(lookups.getAlertMachineLabel({ assetId: "x", hostName: "HOST-X" })).toBe("HOST-X");
    expect(lookups.getAlertMachineLabel({})).toBe("Máquina não vinculada");
  });

  it("troca o nome original do host pelo nome resolvido no título", () => {
    expect(lookups.getResolvedAlertTitle({ assetId: "d1", hostName: "PC-01", title: "CPU alta em PC-01" })).toBe("CPU alta em Computador da Ana");
    expect(lookups.getResolvedAlertTitle({ assetId: "d2", hostName: "SRV-02", title: "Falha em SRV-02" })).toBe("Falha em SRV-02");
    expect(lookups.getResolvedAlertTitle({ hostName: "", title: "" })).toBe("Aviso");
  });

  it("resolve o rótulo e o título compacto da sugestão", () => {
    const suggestion = { assetId: "d1", alertType: "cpu_high", hostName: "PC-01" };

    expect(lookups.getResolvedSuggestionMachineLabel(suggestion)).toBe("Computador da Ana");
    expect(lookups.getResolvedSuggestionTitle(suggestion)).toBe("CPU alta em Computador da Ana");
    expect(lookups.getResolvedSuggestionMachineLabel({ machineAlias: "Apelido" })).toBe("Apelido");
    expect(lookups.getResolvedSuggestionMachineLabel({})).toBe("Máquina não vinculada");
  });
});
