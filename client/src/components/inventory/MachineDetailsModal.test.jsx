import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import MachineDetailsModal from "./MachineDetailsModal.jsx";

vi.mock("../../api.js", () => ({ fetchAssetTimeline: vi.fn(), fetchDeviceMetricHistory: vi.fn() }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,AAA") } }));
vi.mock("../remoteAssistance/RemoteAssistanceAction.jsx", () => ({
  default: ({ asset, alias }) => <span data-testid="remote">{asset?.id}|{alias}</span>
}));

const agentMachine = {
  id: "a1", name: "PC-AGENTE", ip: "10.0.0.5", source: "agent", dataSources: ["agent", "ocs"], assetType: "desktop", status: "offline", statusLabel: "Offline",
  uptimeHours: 12, lastSeenAt: "2026-01-02T10:00:00Z", isBackup: false, backupStatus: "available",
  sourceCollections: { agent: "2026-01-02T10:00:00Z", ocs: "2026-01-01T10:00:00Z", zabbix: null }, sourceConflicts: [{ field: "ip" }],
  automationIndicators: [{ id: "i1", label: "Auto", status: "ok" }],
  metrics: { cpu: 91, ram: 75, disk: 10 },
  alerts: [{ id: "al1", status: "active", severity: "critical", title: "CPU alta", description: "CPU 91%", startedAt: "2026-01-02T09:00:00Z", metric: "cpu", value: "91%", limit: "85%" }, { id: "al2", status: "resolved" }],
  assetHistory: [{ id: "h1", change: "Alerta resolvido: RAM normal", detectedAt: "2026-01-01T12:00:00Z", field: "ram", newValue: "40%", oldValue: "90%" }],
  agent: { lastSeenAt: "2026-01-02T10:00:00Z", agentVersion: "1.2.3", diskFreeBytes: 5 * 1024 ** 3, diskTotalBytes: 500 * 1024 ** 3, memoryTotalBytes: 16 * 1024 ** 3, uptimeSeconds: 90000, loggedUser: "ana", intervalSeconds: 60, macAddress: "AA:BB", hostname: "pc-agente" },
  hardware: {
    architecture: "x64", assetTag: "PAT-1", os: "Windows 11", osVersion: "23H2", manufacturer: "Dell", model: "Optiplex", serialNumber: "SN1",
    cpuModel: "i7", cpuDetails: { name: "Intel i7", logicalProcessors: 16, maxClockMhz: 4700, virtualizationEnabled: false },
    ramGb: 16, memoryHealth: { status: "OK", moduleDetails: [{ bank: "A1", status: "OK", capacityGb: 8, speedMhz: 3200, manufacturer: "Kingston" }, { capacityGb: 8 }] },
    graphics: [{ name: "RTX", status: "OK", memoryBytes: 8 * 1024 ** 3, resolution: "1920x1080" }, {}],
    motherboard: { manufacturer: "Dell", product: "X" },
    disks: [{ label: "C:", sizeGb: 500, type: "SSD", smartStatus: "OK", healthPercent: 90, temperatureC: 40 }, { type: "HDD" }],
    battery: { name: "Bat", chargePercent: 80, estimatedMinutes: 120 },
    licenses: { windowsKey: "W-KEY" },
    software: ["Chrome", { name: "Office", version: "16", manufacturer: "MS", installedAt: "2025-01-01T00:00:00Z" }, { title: "Zoom", publisher: "ZoomCo" }, {}],
    networkAdapters: [{ name: "Ethernet" }, { name: "Wi-Fi" }, {}],
    peripherals: [{ id: "p1", type: "Monitor", brand: "LG", model: "24", assetTag: "M1" }],
    changeHistory: [{ id: "c1", message: "Valor voltou ao normal", createdAt: "2026-01-01T00:00:00Z" }]
  }
};
const manualMachine = {
  id: "m1", name: "SW-CORE", ip: "10.0.0.2", source: "manual", assetType: "switch", status: "online", statusLabel: "Online", segmentName: "Manutenção",
  isBackup: true, backupStatus: "in_use", lastPingAt: "2026-01-02T09:00:00Z",
  manualAsset: { identificationMode: "fixed_ip", assetTag: "NET-1", location: "Sala 1", hostname: "sw-core" }, hardware: { macAddress: "AA:11" }
};
const monitoredMachine = {
  id: "z1", name: "SRV-ZBX", ip: "10.0.0.9", source: "zabbix", assetType: "server", status: "problem", statusLabel: "Problema", uptimeHours: 100,
  metrics: { cpu: 10, ram: 72, disk: null, networkInMbps: 1, networkOutMbps: 2 }, hardware: { disks: [{ health: "Saudável" }] }
};

function handlers() {
  return {
    token: "t", user: { id: "u" }, notify: vi.fn(), alias: "Apelido", observations: [], segmentColor: "#ff0000", userName: "Ana",
    onAliasSave: vi.fn(), onAddObservation: vi.fn(), onChangeDeviceType: vi.fn(), onRefreshPing: vi.fn(), onPutMaintenance: vi.fn(), onToggleBackup: vi.fn(),
    onRemoveMachine: vi.fn(), onAddPeripheral: vi.fn(), onRemovePeripheral: vi.fn(), onOpenNetworkMap: vi.fn(), onClose: vi.fn()
  };
}

async function renderModal(machine, overrides = {}) {
  const props = { machine, canManage: true, ...handlers(), ...overrides };
  const user = userEvent.setup();
  const utils = render(<MachineDetailsModal {...props} />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  return { props, user, ...utils };
}
const tab = (name) => screen.getByRole("button", { name });
const body = () => document.querySelector(".asset-modal-body");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  api.fetchAssetTimeline.mockResolvedValue({ events: [], summary: { total: 0 }, topologyReferences: [], metadata: { total: 0 } });
});

describe("MachineDetailsModal — estrutura", () => {
  it("não renderiza sem máquina", async () => {
    await renderModal(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("expõe o diálogo, o cabeçalho de máquina real e as abas incluindo alertas", async () => {
    await renderModal(agentMachine);
    expect(screen.getByRole("dialog", { name: "Detalhes do ativo" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Máquina real")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Apelido" })).toBeInTheDocument();
    expect(screen.getByText("PC-AGENTE - 10.0.0.5")).toBeInTheDocument();
    expect(screen.getByTestId("remote")).toHaveTextContent("a1|Apelido");
    const names = within(screen.getByRole("navigation", { name: "Detalhes da máquina" })).getAllByRole("button").map((button) => button.textContent);
    expect(names).toEqual(["Geral", "Alertas", "Hardware", "Softwares", "Rede", "Periféricos", "Observações", "Prontuário Técnico"]);
  });

  it("oculta a aba de alertas quando não há alertas e volta para Geral", async () => {
    const clean = { ...manualMachine, status: "online" };
    const { rerender, props, user } = await renderModal(agentMachine);
    await user.click(tab("Alertas"));
    expect(screen.getByText("Alertas ativos")).toBeInTheDocument();
    rerender(<MachineDetailsModal {...props} machine={clean} />);
    expect(screen.queryByRole("button", { name: "Alertas" })).toBeNull();
    expect(screen.getByText("Ativo de rede manual")).toBeInTheDocument();
    expect(tab("Geral")).toHaveClass("active");
  });

  it("identifica o rótulo de origem inventário integrado", async () => {
    await renderModal(monitoredMachine);
    expect(screen.getByText("Inventário integrado")).toBeInTheDocument();
  });

  it("aciona manutenção, backup, remoção e fechar", async () => {
    const { props, user } = await renderModal({ ...agentMachine, isBackup: true });
    await user.click(screen.getByRole("button", { name: "Colocar em manutenção" }));
    await user.click(screen.getByRole("button", { name: "Remover Backup" }));
    await user.click(screen.getByRole("button", { name: "Remover" }));
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(props.onPutMaintenance).toHaveBeenCalled();
    expect(props.onToggleBackup).toHaveBeenCalledWith(false);
    expect(props.onRemoveMachine).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("mostra estados de manutenção e backup em uso", async () => {
    await renderModal(manualMachine);
    expect(screen.getByRole("button", { name: "Retirar da manutenção" })).toHaveClass("active");
    const backup = screen.getByRole("button", { name: "Backup em uso" });
    expect(backup).toBeDisabled();
    expect(backup).toHaveAttribute("title", "Backup em uso por uma OS");
  });

  it("fecha com Escape", async () => {
    const { props, user } = await renderModal(agentMachine);
    await user.keyboard("{Escape}");
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("MachineDetailsModal — aba Geral", () => {
  it("mostra cartões e detalhes de uma máquina com agente", async () => {
    await renderModal(agentMachine);
    expect(screen.getByText("Versão do coletor")).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
    expect(screen.getByText("5.0 GB")).toBeInTheDocument();
    expect(screen.getByText("Agent + OCS")).toBeInTheDocument();
    expect(screen.getByText("Última coleta OCS")).toBeInTheDocument();
    expect(screen.queryByText("Última coleta Zabbix")).toBeNull();
    expect(screen.getByText("Conflito pendente de revisão")).toBeInTheDocument();
    expect(screen.getByText("Intervalo de coleta")).toBeInTheDocument();
    expect(screen.getByText("60 s")).toBeInTheDocument();
    expect(screen.getByText("Última alteração detectada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Atualizar ping/ })).toBeNull();
  });

  it("mostra detalhes e atualização de ping de ativo manual", async () => {
    const { props, user } = await renderModal(manualMachine);
    expect(screen.getByText("IP fixo")).toBeInTheDocument();
    expect(screen.getByText("NET-1")).toBeInTheDocument();
    expect(screen.getByText("Nome cadastrado")).toBeInTheDocument();
    expect(screen.getByText("Localização")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Atualizar ping/ }));
    expect(props.onRefreshPing).toHaveBeenCalled();
  });

  it("mostra métricas de uma máquina monitorada e troca o tipo do aparelho", async () => {
    const { props, user } = await renderModal(monitoredMachine);
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getAllByText("Não disponível").length).toBeGreaterThan(0);
    expect(screen.getByText("Saúde do disco")).toBeInTheDocument();
    const select = screen.getByLabelText("Tipo do aparelho");
    await user.selectOptions(select, select.options[0].value);
    expect(props.onChangeDeviceType).toHaveBeenCalled();
  });

  it("usa o tipo padrão do aparelho", async () => {
    const { props } = await renderModal({ ...monitoredMachine, assetType: undefined });
    expect(screen.getByLabelText("Tipo do aparelho")).toHaveValue("other");
    expect(props.onAliasSave).not.toHaveBeenCalled();
  });
});

describe("MachineDetailsModal — demais abas", () => {
  it("lista alertas ativos e resolvidos", async () => {
    const { user } = await renderModal(agentMachine);
    await user.click(tab("Alertas"));
    const section = body();
    expect(within(section).getByText("CPU acima do limite: 91%")).toBeInTheDocument();
    expect(within(section).getByText("Máquina não responde ping")).toBeInTheDocument();
    expect(within(section).getByText("CPU 91%")).toBeInTheDocument();
    expect(within(section).getByText("Alerta resolvido: RAM normal")).toBeInTheDocument();
    expect(within(section).getByText("Valor voltou ao normal")).toBeInTheDocument();
  });

  it("gera alerta de problema de monitoramento e alerta de atenção", async () => {
    const { user } = await renderModal({ ...monitoredMachine, metrics: { cpu: 75 } });
    await user.click(tab("Alertas"));
    expect(screen.getByText("CPU acima do limite: 75%")).toBeInTheDocument();
    expect(screen.queryByText("Alerta ativo no monitoramento")).toBeNull();
  });

  it("mostra alerta genérico quando só o status é problema", async () => {
    const { user } = await renderModal({ ...monitoredMachine, metrics: {} });
    await user.click(tab("Alertas"));
    expect(screen.getByText("Alerta ativo no monitoramento")).toBeInTheDocument();
    expect(screen.getByText("Nenhum erro resolvido registrado ainda.")).toBeInTheDocument();
  });

  it("mostra todas as seções de hardware", async () => {
    const { user } = await renderModal(agentMachine);
    await user.click(tab("Hardware"));
    for (const title of ["Sistema e equipamento", "Processador", "Memória", "Vídeo", "Placa-mãe", "Armazenamento", "Energia", "Licenciamento"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText("Kingston")).toBeInTheDocument();
    expect(screen.getByText("Módulo 2")).toBeInTheDocument();
    expect(screen.getByText("Adaptador 2")).toBeInTheDocument();
    expect(screen.getByText("Disco 2")).toBeInTheDocument();
    expect(screen.getByText("W-KEY")).toBeInTheDocument();
    expect(screen.getByText("4700 MHz")).toBeInTheDocument();
    expect(screen.getByText("Usuário local")).toBeInTheDocument();
    expect(screen.getByText("ana")).toBeInTheDocument();
  });

  it("mostra mensagens vazias do hardware", async () => {
    const { user } = await renderModal(manualMachine);
    await user.click(tab("Hardware"));
    expect(screen.getByText("Nenhum módulo individual identificado.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum adaptador de vídeo identificado.")).toBeInTheDocument();
    expect(screen.getByText("Ativo de rede sem coleta automática de discos.")).toBeInTheDocument();
    await user.click(tab("Geral"));
  });

  it("mostra mensagem de discos ausentes em máquina não manual", async () => {
    const { user } = await renderModal({ ...monitoredMachine, hardware: {} });
    await user.click(tab("Hardware"));
    expect(screen.getByText("Nenhuma unidade física identificada.")).toBeInTheDocument();
  });

  it("lista softwares normalizados e as mensagens vazias", async () => {
    const first = await renderModal(agentMachine);
    await first.user.click(tab("Softwares"));
    expect(screen.getByText("Chrome")).toBeInTheDocument();
    expect(screen.getByText("Zoom")).toBeInTheDocument();
    expect(screen.getByText("Software sem nome")).toBeInTheDocument();
    expect(screen.getByText("Fabricante: ZoomCo")).toBeInTheDocument();
    first.unmount();
    const second = await renderModal(monitoredMachine);
    await second.user.click(tab("Softwares"));
    expect(screen.getByText("Nenhum software coletado para esta máquina.")).toBeInTheDocument();
    second.unmount();
    const third = await renderModal(manualMachine);
    await third.user.click(tab("Softwares"));
    expect(screen.getByText("Softwares não se aplicam a este ativo manual.")).toBeInTheDocument();
  });

  it("mostra a aba de rede conforme a origem", async () => {
    const first = await renderModal(agentMachine);
    await first.user.click(tab("Rede"));
    expect(screen.getByText("AA:BB")).toBeInTheDocument();
    expect(screen.getByText("Ethernet, Wi-Fi")).toBeInTheDocument();
    expect(screen.getByText(/Agente IT Guardian/)).toBeInTheDocument();
    first.unmount();
    const second = await renderModal(manualMachine);
    await second.user.click(tab("Rede"));
    expect(screen.getByText("Modo de identificação")).toBeInTheDocument();
    expect(screen.getByText(/ping real/)).toBeInTheDocument();
    second.unmount();
    const third = await renderModal(monitoredMachine);
    await third.user.click(tab("Rede"));
    expect(screen.getByText("1 Mbps")).toBeInTheDocument();
    expect(screen.getByText(/Telemetria fornecida/)).toBeInTheDocument();
  });

  it("mostra periféricos para máquinas e aviso para ativos manuais", async () => {
    const first = await renderModal(agentMachine);
    await first.user.click(tab("Periféricos"));
    expect(screen.getAllByText(/Monitor/).length).toBeGreaterThan(0);
    first.unmount();
    const second = await renderModal(manualMachine);
    await second.user.click(tab("Periféricos"));
    expect(screen.getByText(/não são periféricos USB/)).toBeInTheDocument();
  });

  it("carrega o prontuário técnico e as observações", async () => {
    const { user, props } = await renderModal(agentMachine, { observations: [{ id: "o1", text: "Troca de pasta térmica", author: "ana", createdAt: "2026-01-01T00:00:00Z" }] });
    await user.click(tab("Observações"));
    expect(screen.getByText("Troca de pasta térmica")).toBeInTheDocument();
    await user.click(tab("Prontuário Técnico"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(api.fetchAssetTimeline).toHaveBeenCalledWith("t", "a1", expect.any(Object));
    expect(props.onOpenNetworkMap).not.toHaveBeenCalled();
  });
});
