import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as identity from "../../api/identityApi.js";
import { copyText } from "../../auth/clipboard.js";
import { generateQrDataUrl } from "../../auth/qrCode.js";
import { apiError, baseUser, renderWithSession } from "../../test/identityHarness.jsx";
import AccountSecurityPage from "./AccountSecurityPage.jsx";

vi.mock("../../api/identityApi.js");
vi.mock("../../auth/qrCode.js");
vi.mock("../../auth/clipboard.js");

const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36";
const sessions = [
  { id: "s1", current: true, ip: "10.0.0.1", userAgent: chrome, lastSeenAt: "2026-10-02T12:00:00Z", createdAt: "2026-10-02T10:00:00Z" },
  { id: "s2", current: false, ip: "10.0.0.2", userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile", lastSeenAt: "2026-10-01T12:00:00Z", createdAt: "2026-10-01T10:00:00Z" }
];

beforeEach(() => {
  vi.clearAllMocks();
  identity.fetchSessions.mockResolvedValue(sessions);
  identity.fetchMfaStatus.mockResolvedValue({ enabled: false, requiredForAdmins: false, recoveryCodesLeft: 0 });
  identity.fetchMe.mockResolvedValue({ token: "tok-2", user: { ...baseUser, mfaEnabled: true } });
  generateQrDataUrl.mockResolvedValue("data:image/png;base64,QR");
  copyText.mockResolvedValue(true);
});

async function mount(options = {}) {
  const { session, tree } = renderWithSession(<AccountSecurityPage />, { user: { ...baseUser, isAdmin: false, role: "viewer" }, ...options });
  render(tree);
  await screen.findByRole("list", { name: "Sessões ativas" });
  return { session, user: userEvent.setup() };
}

describe("pagina Seguranca da conta", () => {
  it("mostra titulo focado, senha, MFA e sessoes", async () => {
    await mount();
    expect(screen.getByRole("heading", { name: "Segurança da conta" })).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Senha" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Verificação em duas etapas/ })).toBeInTheDocument();
    expect(await screen.findByText(/Desativada\./)).toBeInTheDocument();
  });

  it("trocar a senha atualiza a sessao do app e recarrega as sessoes", async () => {
    const newSession = { token: "tok-9", user: baseUser };
    identity.changePassword.mockResolvedValue(newSession);
    const { session, user } = await mount();
    const before = identity.fetchSessions.mock.calls.length;

    await user.type(screen.getByLabelText("Senha atual"), "senha-antiga-123");
    await user.type(screen.getByLabelText("Nova senha"), "cavalo azul come batata");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "cavalo azul come batata");
    await user.click(screen.getByRole("button", { name: "Trocar senha" }));

    await waitFor(() => expect(session.handleAuth).toHaveBeenCalledWith(newSession));
    expect(session.notify).toHaveBeenCalledWith("Senha alterada. Os outros dispositivos foram desconectados.", "ok");
    await waitFor(() => expect(identity.fetchSessions.mock.calls.length).toBeGreaterThan(before));
  });
});

describe("sessoes", () => {
  it("lista dispositivo, IP e marca a sessao atual sem botao de encerrar", async () => {
    await mount();
    const items = screen.getAllByRole("listitem").filter((item) => item.closest(".account-sessions"));
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Esta sessão")).toBeInTheDocument();
    expect(within(items[0]).getByText("Chrome em Windows")).toBeInTheDocument();
    expect(within(items[0]).queryByRole("button")).not.toBeInTheDocument();
    expect(within(items[1]).getByText(/IP 10\.0\.0\.2/)).toBeInTheDocument();
  });

  it("encerra uma sessao e recarrega a lista", async () => {
    identity.revokeSession.mockResolvedValue({});
    const { session, user } = await mount();
    await user.click(screen.getByRole("button", { name: /Encerrar sessão de Chrome em Android/ }));

    await waitFor(() => expect(identity.revokeSession).toHaveBeenCalledWith("tok-1", "s2"));
    expect(session.notify).toHaveBeenCalledWith("Sessão encerrada.", "ok");
    await waitFor(() => expect(identity.fetchSessions).toHaveBeenCalledTimes(2));
  });

  it("encerra todas as outras", async () => {
    identity.revokeOtherSessions.mockResolvedValue({ revoked: 1 });
    const { session, user } = await mount();
    await user.click(screen.getByRole("button", { name: "Encerrar todas as outras" }));
    await waitFor(() => expect(identity.revokeOtherSessions).toHaveBeenCalledWith("tok-1"));
    expect(session.notify).toHaveBeenCalledWith("Outras sessões encerradas.", "ok");
  });

  it("desabilita 'encerrar todas' quando so existe a sessao atual", async () => {
    identity.fetchSessions.mockResolvedValue([sessions[0]]);
    await mount();
    expect(screen.getByRole("button", { name: "Encerrar todas as outras" })).toBeDisabled();
  });

  it("404 ao encerrar (ja acabou) apenas recarrega; outros erros aparecem", async () => {
    identity.revokeSession.mockRejectedValueOnce(apiError(undefined, 404, "Sessão não encontrada."));
    const { user } = await mount();
    await user.click(screen.getByRole("button", { name: /Encerrar sessão de/ }));
    await waitFor(() => expect(identity.fetchSessions).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Sessão não encontrada.")).not.toBeInTheDocument();

    identity.revokeSession.mockRejectedValueOnce(apiError(undefined, 500, "x"));
    await user.click(screen.getByRole("button", { name: /Encerrar sessão de/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível concluir a operação");
  });

  it("falha ao carregar mostra erro", async () => {
    identity.fetchSessions.mockRejectedValue(apiError("NETWORK_ERROR", undefined));
    const { tree } = renderWithSession(<AccountSecurityPage />);
    render(tree);
    expect(await screen.findByText(/Não foi possível conectar/)).toBeInTheDocument();
  });
});

describe("MFA na pagina", () => {
  it("ativa pelo assistente, mostra codigos uma vez e atualiza o usuario", async () => {
    identity.startMfaSetup.mockResolvedValue({ secret: "ABCDEFGH", otpauthUri: "otpauth://x" });
    identity.enableMfa.mockResolvedValue({ recoveryCodes: ["AAAAA-11111"] });
    const { session, user } = await mount();

    await user.click(await screen.findByRole("button", { name: "Ativar verificação em duas etapas" }));
    await user.click(screen.getByRole("button", { name: "Começar" }));
    await user.type(await screen.findByLabelText("Código do aplicativo"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar e ativar" }));
    await screen.findByText("AAAAA-11111");

    identity.fetchMfaStatus.mockResolvedValue({ enabled: true, requiredForAdmins: false, recoveryCodesLeft: 1 });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => expect(session.handleAuth).toHaveBeenCalledWith({ token: "tok-2", user: expect.objectContaining({ mfaEnabled: true }) }));
    expect(session.notify).toHaveBeenCalledWith("Verificação em duas etapas ativada.", "ok");
    expect(await screen.findByText(/Códigos de recuperação restantes: 1/)).toBeInTheDocument();
    expect(screen.queryByText("AAAAA-11111")).not.toBeInTheDocument();
  });

  it("cancelar o assistente volta ao estado inicial", async () => {
    const { user } = await mount();
    await user.click(await screen.findByRole("button", { name: "Ativar verificação em duas etapas" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Ativar verificação em duas etapas" })).toBeInTheDocument();
  });

  describe("com MFA ativo", () => {
    beforeEach(() => {
      identity.fetchMfaStatus.mockResolvedValue({ enabled: true, requiredForAdmins: false, recoveryCodesLeft: 4 });
    });

    it("desativa exigindo senha e codigo", async () => {
      identity.disableMfa.mockResolvedValue({});
      const { session, user } = await mount();
      await user.click(await screen.findByRole("button", { name: "Desativar" }));

      const form = screen.getByRole("form", { name: "Desativar verificação em duas etapas" });
      await user.click(within(form).getByRole("button", { name: "Desativar" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Informe sua senha.");

      await user.type(within(form).getByLabelText("Senha"), "minha-senha");
      await user.click(within(form).getByRole("button", { name: "Desativar" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Digite os 6 dígitos do código.");

      await user.type(within(form).getByLabelText("Código do aplicativo"), "123456");
      await user.click(within(form).getByRole("button", { name: "Desativar" }));

      await waitFor(() => expect(identity.disableMfa).toHaveBeenCalledWith("tok-1", { password: "minha-senha", code: "123456" }));
      expect(session.notify).toHaveBeenCalledWith("Verificação em duas etapas desativada.", "ok");
    });

    it("senha errada ao desativar volta o foco para a senha", async () => {
      identity.disableMfa.mockRejectedValue(apiError("CURRENT_PASSWORD_INVALID"));
      const { user } = await mount();
      await user.click(await screen.findByRole("button", { name: "Desativar" }));
      const form = screen.getByRole("form", { name: "Desativar verificação em duas etapas" });
      await user.type(within(form).getByLabelText("Senha"), "errada");
      await user.type(within(form).getByLabelText("Código do aplicativo"), "123456");
      await user.click(within(form).getByRole("button", { name: "Desativar" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("A senha atual está incorreta.");
      expect(within(form).getByLabelText("Senha")).toHaveFocus();
    });

    it("regera codigos de recuperacao usando codigo de recuperacao como segundo fator e mostra uma vez", async () => {
      identity.regenerateRecoveryCodes.mockResolvedValue({ recoveryCodes: ["NEW11-AAAAA", "NEW22-BBBBB"] });
      const { user } = await mount();
      await user.click(await screen.findByRole("button", { name: /Gerar novos códigos de recuperação/ }));
      const form = screen.getByRole("form", { name: "Gerar novos códigos de recuperação" });

      await user.type(within(form).getByLabelText("Senha"), "minha-senha");
      await user.click(within(form).getByRole("button", { name: "Usar código de recuperação" }));
      await user.click(within(form).getByRole("button", { name: "Gerar novos códigos" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Informe um código de recuperação.");
      await user.type(within(form).getByLabelText("Código de recuperação"), "old11-aaaaa");
      await user.click(within(form).getByRole("button", { name: "Gerar novos códigos" }));

      expect(await screen.findByText("NEW11-AAAAA")).toBeInTheDocument();
      expect(identity.regenerateRecoveryCodes).toHaveBeenCalledWith("tok-1", { password: "minha-senha", recoveryCode: "OLD11-AAAAA" });
      await user.click(screen.getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "Concluir" }));
      expect(screen.queryByText("NEW11-AAAAA")).not.toBeInTheDocument();
    });

    it("cancela o formulario de reautenticacao", async () => {
      const { user } = await mount();
      await user.click(await screen.findByRole("button", { name: /Gerar novos códigos de recuperação/ }));
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByRole("form", { name: "Gerar novos códigos de recuperação" })).not.toBeInTheDocument();
    });

    it("admin com MFA obrigatorio nao pode desativar", async () => {
      identity.fetchMfaStatus.mockResolvedValue({ enabled: true, requiredForAdmins: true, recoveryCodesLeft: 4 });
      await mount({ user: baseUser });
      expect(await screen.findByText(/obrigatória para administradores/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Desativar" })).not.toBeInTheDocument();
    });
  });

  it("erro ao carregar o status aparece", async () => {
    identity.fetchMfaStatus.mockRejectedValue(apiError(undefined, 500, "x"));
    await mount();
    expect(await screen.findByText("Não foi possível carregar o estado da verificação em duas etapas.")).toBeInTheDocument();
  });
});
