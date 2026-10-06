import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api.js", () => ({
  createProductKey: vi.fn(),
  deactivateProductKeyActivation: vi.fn(),
  fetchIntegrationStatus: vi.fn(),
  fetchProductKeyActivations: vi.fn(),
  fetchProductKeys: vi.fn(),
  synchronizeIntegration: vi.fn(),
  testIntegrationConnection: vi.fn(),
  updateProductKeyStatus: vi.fn()
}));

import * as api from "../../api.js";
import CloudProductAdminPanel from "./CloudProductAdminPanel.jsx";

const keyActive = {
  id: "k1",
  displayName: "Cliente principal",
  organizationName: "Acme",
  planName: "Beta",
  keyHint: "ABCD",
  active: true,
  activationCount: 1,
  activationLimit: 5,
  expiresAt: "2030-01-15T12:00:00Z"
};
const keyInactive = { ...keyActive, id: "k2", displayName: "Antiga", active: false, expiresAt: null };
const activationFixture = [
  { id: "a1", hostname: "PC-01", alias: "Recepção", status: "active", collectorVersion: "1.6.3", firstSeenAt: "2026-01-01T10:00:00Z", lastSeenAt: "bad-date" },
  { id: "a2", hostname: "PC-02", alias: "", status: "inactive", collectorVersion: "", firstSeenAt: null, lastSeenAt: null }
];

let notify;

function mount(props = {}) {
  notify = vi.fn();
  render(<CloudProductAdminPanel token="tok" notify={notify} {...props} />);
  return userEvent.setup();
}

beforeEach(() => {
  api.fetchProductKeys.mockResolvedValue({ productKeys: [keyActive, keyInactive] });
  api.fetchIntegrationStatus.mockImplementation(async (_token, source) => (
    source === "ocs"
      ? { configuration: { enabled: true, mode: "read_only", configured: true }, state: { lastSyncAt: "2026-02-03T10:00:00Z" }, conflicts: [1, 2] }
      : { configuration: { enabled: false, mode: "disabled" } }
  ));
  api.fetchProductKeyActivations.mockResolvedValue({ activations: activationFixture });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("CloudProductAdminPanel - carga inicial", () => {
  it("lista chaves, instalador e integracoes com seus estados", async () => {
    mount();
    expect(screen.getByText("Carregando chaves...")).toBeInTheDocument();
    await screen.findByText("Cliente principal");
    expect(screen.getByText("Antiga")).toBeInTheDocument();
    expect(screen.getAllByText("Acme - Beta", { selector: "small" })).toHaveLength(2);
    expect(screen.getAllByText("1 / 5", { exact: false })).toHaveLength(2);
    expect(screen.getByText("Sem expiracao")).toBeInTheDocument();
    expect(screen.getByText(/^Expira /, { selector: ".cloud-key-expiry" })).toBeInTheDocument();
    const installer = screen.getByRole("link", { name: /Baixar instalador/ });
    expect(installer).toHaveAttribute("href", expect.stringContaining("ITGuardian-Collector-Setup.exe"));
    expect(installer).toHaveAttribute("download");

    await waitFor(() => expect(screen.getByText("Sincronizada")).toBeInTheDocument());
    expect(screen.getByText("Desativada")).toBeInTheDocument();
    expect(screen.getByText("read_only")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Sincronizada")).toHaveClass("success");
    expect(screen.getByText("Desativada")).toHaveClass("muted");
  });

  it("sem chaves mostra o vazio", async () => {
    api.fetchProductKeys.mockResolvedValue({});
    mount();
    expect(await screen.findByText("Nenhuma chave de produto cadastrada.")).toBeInTheDocument();
  });

  it("falha nas chaves notifica; falha em integracao vira Indisponivel", async () => {
    api.fetchProductKeys.mockRejectedValue(new Error("Sem acesso"));
    api.fetchIntegrationStatus.mockRejectedValue(new Error("Fora do ar"));
    mount();
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Sem acesso", "danger"));
    await waitFor(() => expect(screen.getAllByText("Indisponível")).toHaveLength(2));
    expect(screen.getAllByText("Fora do ar")).toHaveLength(2);
    expect(screen.getAllByText("indisponivel")).toHaveLength(2);
    expect(screen.getAllByText("Indisponível")[0]).toHaveClass("danger");
  });

  it("falha sem mensagem usa o texto padrao", async () => {
    api.fetchProductKeys.mockRejectedValue({});
    api.fetchIntegrationStatus.mockRejectedValue({});
    mount();
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Falha ao carregar chaves.", "danger"));
    expect(await screen.findAllByText("Falha ao consultar integração.")).toHaveLength(2);
  });

  it("estados Incompleta e Com erro e Configurada", async () => {
    api.fetchIntegrationStatus.mockImplementation(async (_t, source) => (
      source === "ocs"
        ? { configuration: { enabled: true, mode: "read_only", configured: false } }
        : { configuration: { enabled: true, mode: "read_only", configured: true }, state: { lastError: "x" } }
    ));
    mount();
    expect(await screen.findByText("Incompleta")).toBeInTheDocument();
    expect(screen.getByText("Com erro")).toBeInTheDocument();
    api.fetchIntegrationStatus.mockResolvedValue({ configuration: { enabled: true, mode: "read_only", configured: true } });
  });

  it("atualizar chaves recarrega a lista", async () => {
    const user = mount();
    await screen.findByText("Cliente principal");
    api.fetchProductKeys.mockResolvedValue({ productKeys: [keyInactive] });
    await user.click(screen.getByRole("button", { name: "Atualizar chaves" }));
    await waitFor(() => expect(screen.queryByText("Cliente principal")).not.toBeInTheDocument());
  });
});

describe("CloudProductAdminPanel - criar chave", () => {
  it("exige nome e organizacao", async () => {
    const user = mount();
    await screen.findByText("Cliente principal");
    await user.click(screen.getByRole("button", { name: /Gerar chave/ }));
    expect(notify).toHaveBeenCalledWith("Informe o nome da chave e a organização.", "danger");
    expect(api.createProductKey).not.toHaveBeenCalled();
  });

  it("cria, revela a chave uma vez, limpa o formulario e permite copiar", async () => {
    api.createProductKey.mockResolvedValue({ key: "ITG-AAAA-BBBB", warning: "Guarde agora.", productKey: keyActive });
    const writeText = vi.fn().mockResolvedValue();
    const user = mount();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await screen.findByText("Cliente principal");
    expect(screen.getByText("Exibição única")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nome de exibição"), "Novo");
    await user.type(screen.getByLabelText("Organização"), "Org");
    await user.clear(screen.getByLabelText("Plano"));
    await user.type(screen.getByLabelText("Plano"), "Pro");
    await user.clear(screen.getByLabelText("Limite de computadores"));
    await user.type(screen.getByLabelText("Limite de computadores"), "7");
    fireEvent.change(screen.getByLabelText("Expira em"), { target: { value: "2031-02-03" } });
    await user.click(screen.getByRole("button", { name: /Gerar chave/ }));

    await waitFor(() => expect(api.createProductKey).toHaveBeenCalled());
    expect(api.createProductKey).toHaveBeenCalledWith("tok", {
      displayName: "Novo",
      organizationName: "Org",
      planName: "Pro",
      activationLimit: 7,
      expiresAt: "2031-02-03"
    });
    expect(await screen.findByText("Chave criada")).toBeInTheDocument();
    expect(screen.getByText("ITG-AAAA-BBBB")).toBeInTheDocument();
    expect(screen.getByText("Guarde agora.")).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith("Chave de produto criada.", "ok");
    expect(screen.getByLabelText("Nome de exibição")).toHaveValue("");
    expect(screen.getByLabelText("Plano")).toHaveValue("Beta");

    await user.click(screen.getByRole("button", { name: /Copiar/ }));
    expect(writeText).toHaveBeenCalledWith("ITG-AAAA-BBBB");
    expect(notify).toHaveBeenCalledWith("Chave copiada. Guarde-a em um local seguro.", "ok");
  });

  it("falha ao copiar orienta selecionar a chave", async () => {
    api.createProductKey.mockResolvedValue({ key: "ITG-X", warning: "w" });
    const user = mount();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("no")) }, configurable: true });
    await screen.findByText("Cliente principal");
    await user.type(screen.getByLabelText("Nome de exibição"), "N");
    await user.type(screen.getByLabelText("Organização"), "O");
    await user.click(screen.getByRole("button", { name: /Gerar chave/ }));
    await user.click(await screen.findByRole("button", { name: /Copiar/ }));
    expect(notify).toHaveBeenCalledWith("Não foi possível copiar automaticamente. Selecione a chave exibida.", "danger");
  });

  it("erro do servidor ao criar notifica", async () => {
    api.createProductKey.mockRejectedValue(new Error("Limite excedido"));
    const user = mount();
    await screen.findByText("Cliente principal");
    await user.type(screen.getByLabelText("Nome de exibição"), "N");
    await user.type(screen.getByLabelText("Organização"), "O");
    await user.click(screen.getByRole("button", { name: /Gerar chave/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Limite excedido", "danger"));
    expect(screen.getByText("Exibição única")).toBeInTheDocument();
  });
});

describe("CloudProductAdminPanel - status e ativacoes", () => {
  it("desativar pede confirmacao; cancelar nao chama; confirmar atualiza e notifica", async () => {
    api.updateProductKeyStatus.mockResolvedValue({});
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const user = mount();
    await screen.findByText("Cliente principal");
    const card = screen.getByText("Cliente principal").closest("article");
    await user.click(within(card).getByRole("button", { name: "Desativar" }));
    expect(api.updateProductKeyStatus).not.toHaveBeenCalled();
    await user.click(within(card).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(api.updateProductKeyStatus).toHaveBeenCalledWith("tok", "k1", false));
    expect(confirm).toHaveBeenCalledWith("Desativar esta chave e todos os coletores vinculados?");
    expect(notify).toHaveBeenCalledWith("Chave desativada.", "ok");
  });

  it("reativar nao pede confirmacao", async () => {
    api.updateProductKeyStatus.mockResolvedValue({});
    const confirm = vi.spyOn(window, "confirm");
    const user = mount();
    await screen.findByText("Antiga");
    const card = screen.getByText("Antiga").closest("article");
    await user.click(within(card).getByRole("button", { name: "Reativar" }));
    await waitFor(() => expect(api.updateProductKeyStatus).toHaveBeenCalledWith("tok", "k2", true));
    expect(confirm).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("Chave reativada.", "ok");
  });

  it("erro ao mudar status notifica", async () => {
    api.updateProductKeyStatus.mockRejectedValue(new Error("Falhou"));
    const user = mount();
    await screen.findByText("Antiga");
    await user.click(within(screen.getByText("Antiga").closest("article")).getByRole("button", { name: "Reativar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Falhou", "danger"));
  });

  it("expande a chave, lista computadores e recolhe ao clicar de novo", async () => {
    const user = mount();
    await screen.findByText("Cliente principal");
    const summary = screen.getByText("Cliente principal").closest("button");
    expect(summary).toHaveAttribute("aria-expanded", "false");
    await user.click(summary);
    expect(await screen.findByText("Computadores de Cliente principal")).toBeInTheDocument();
    expect(api.fetchProductKeyActivations).toHaveBeenCalledWith("tok", "k1");
    expect(await screen.findByText("Recepção")).toBeInTheDocument();
    expect(screen.getByText("2 registro(s)")).toBeInTheDocument();
    expect(screen.getByText("PC-01 - coletor 1.6.3")).toBeInTheDocument();
    expect(screen.getByText("coletor sem versão")).toBeInTheDocument();
    expect(screen.getAllByText(/Último contato: Não informado/)).toHaveLength(2);
    expect(screen.getByText("Ativo", { selector: ".cloud-activation-status" })).toBeInTheDocument();
    expect(screen.getByText("Desativado", { selector: ".cloud-activation-status" })).toBeInTheDocument();

    await user.click(summary);
    expect(screen.queryByText("Computadores de Cliente principal")).not.toBeInTheDocument();
  });

  it("chave sem computadores mostra o vazio e erro de carga notifica", async () => {
    api.fetchProductKeyActivations.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Sem leitura"));
    const user = mount();
    await screen.findByText("Cliente principal");
    await user.click(screen.getByText("Cliente principal").closest("button"));
    expect(await screen.findByText("Nenhum computador ativou esta chave.")).toBeInTheDocument();
    await user.click(screen.getByText("Antiga").closest("button"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Sem leitura", "danger"));
  });

  it("desativa coletor apos confirmar e recarrega a lista", async () => {
    api.deactivateProductKeyActivation.mockResolvedValue({});
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const user = mount();
    await screen.findByText("Cliente principal");
    await user.click(screen.getByText("Cliente principal").closest("button"));
    const row = (await screen.findByText("Recepção")).closest("article");
    const button = within(row).getByRole("button", { name: "Desativar" });
    await user.click(button);
    expect(api.deactivateProductKeyActivation).not.toHaveBeenCalled();
    await user.click(button);
    await waitFor(() => expect(api.deactivateProductKeyActivation).toHaveBeenCalledWith("tok", "a1"));
    expect(confirm).toHaveBeenCalledWith("Desativar o coletor de PC-01?");
    expect(notify).toHaveBeenCalledWith("Coletor desativado.", "ok");
    const inactiveRow = screen.getByText("PC-02").closest("article");
    expect(within(inactiveRow).getByRole("button", { name: "Desativar" })).toBeDisabled();
  });

  it("erro ao desativar coletor notifica", async () => {
    api.deactivateProductKeyActivation.mockRejectedValue(new Error("Nope"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = mount();
    await screen.findByText("Cliente principal");
    await user.click(screen.getByText("Cliente principal").closest("button"));
    const row = (await screen.findByText("Recepção")).closest("article");
    await user.click(within(row).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Nope", "danger"));
  });

  it("alterar status da chave aberta recarrega as ativacoes", async () => {
    api.updateProductKeyStatus.mockResolvedValue({});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = mount();
    await screen.findByText("Cliente principal");
    await user.click(screen.getByText("Cliente principal").closest("button"));
    await screen.findByText("Recepção");
    api.fetchProductKeyActivations.mockClear();
    await user.click(within(screen.getByText("Cliente principal").closest("article")).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(api.fetchProductKeyActivations).toHaveBeenCalledWith("tok", "k1"));
  });
});

describe("CloudProductAdminPanel - integracoes", () => {
  async function ready() {
    const user = mount();
    await waitFor(() => expect(screen.getByText("Sincronizada")).toBeInTheDocument());
    return user;
  }
  const card = (name) => screen.getByText(name, { selector: ".cloud-integration-heading strong" }).closest("article");

  it("testar conexao valida e recarrega o status", async () => {
    api.testIntegrationConnection.mockResolvedValue({});
    const user = await ready();
    await user.click(within(card("OCS Inventory")).getByRole("button", { name: /Testar/ }));
    await waitFor(() => expect(api.testIntegrationConnection).toHaveBeenCalledWith("tok", "ocs"));
    expect(notify).toHaveBeenCalledWith("Conexão com OCS Inventory validada.", "ok");
  });

  it("sincronizar informa o sucesso", async () => {
    api.synchronizeIntegration.mockResolvedValue({});
    const user = await ready();
    await user.click(within(card("Zabbix")).getByRole("button", { name: /Sincronizar/ }));
    await waitFor(() => expect(api.synchronizeIntegration).toHaveBeenCalledWith("tok", "zabbix"));
    expect(notify).toHaveBeenCalledWith("Zabbix sincronizado.", "ok");
  });

  it("integracao pulada avisa que esta desativada", async () => {
    api.synchronizeIntegration.mockResolvedValue({ skipped: true });
    const user = await ready();
    await user.click(within(card("Zabbix")).getByRole("button", { name: /Sincronizar/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Zabbix esta desativado.", "ok"));
  });

  it("erro na acao notifica e recarrega o status", async () => {
    api.testIntegrationConnection.mockRejectedValue(new Error("Timeout"));
    const user = await ready();
    api.fetchIntegrationStatus.mockClear();
    await user.click(within(card("OCS Inventory")).getByRole("button", { name: /Testar/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Timeout", "danger"));
    await waitFor(() => expect(api.fetchIntegrationStatus).toHaveBeenCalledTimes(2));
  });

  it("notify opcional: sem notify nao quebra", async () => {
    api.fetchProductKeys.mockRejectedValue(new Error("x"));
    render(<CloudProductAdminPanel token="tok" />);
    expect(await screen.findByText("Nenhuma chave de produto cadastrada.")).toBeInTheDocument();
  });
});
