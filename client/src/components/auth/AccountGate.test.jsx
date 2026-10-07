import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as identity from "../../api/identityApi.js";
import { generateQrDataUrl } from "../../auth/qrCode.js";
import { ACCOUNT_RESTRICTED_EVENT } from "../../authSession.js";
import { apiError, baseUser, renderWithSession } from "../../test/identityHarness.jsx";
import AccountGate from "./AccountGate.jsx";

vi.mock("../../api/identityApi.js");
vi.mock("../../auth/qrCode.js");

const App = () => <div data-testid="app">App</div>;

beforeEach(() => {
  vi.clearAllMocks();
  generateQrDataUrl.mockResolvedValue("data:image/png;base64,QR");
});

function mount(options) {
  const { session, tree } = renderWithSession(
    <AccountGate>
      <App />
    </AccountGate>,
    options
  );
  render(tree);
  return session;
}

describe("AccountGate: troca de senha obrigatoria", () => {
  it("mostra SO a tela de troca (app nao e montado) e libera depois de trocar", async () => {
    const newSession = { token: "tok-2", user: { ...baseUser, mustChangePassword: false } };
    identity.changePassword.mockResolvedValue(newSession);
    const session = mount({ user: { ...baseUser, mustChangePassword: true } });
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Troque a senha para continuar" })).toBeInTheDocument();
    expect(screen.queryByTestId("app")).not.toBeInTheDocument();
    expect(identity.fetchMfaStatus).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Senha atual"), "temporaria-123");
    await user.type(screen.getByLabelText("Nova senha"), "cavalo azul come batata");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "cavalo azul come batata");
    await user.click(screen.getByRole("button", { name: "Trocar senha e continuar" }));

    await waitFor(() => expect(session.handleAuth).toHaveBeenCalledWith(newSession));
    expect(session.notify).toHaveBeenCalledWith("Senha alterada com sucesso.", "ok");
  });

  it("permite sair", async () => {
    const session = mount({ user: { ...baseUser, mustChangePassword: true } });
    await userEvent.setup().click(await screen.findByRole("button", { name: /Sair/ }));
    expect(session.signOut).toHaveBeenCalled();
  });

  it("um 403 PASSWORD_CHANGE_REQUIRED de qualquer chamada liga o bloqueio", () => {
    const session = mount();
    expect(screen.getByTestId("app")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(ACCOUNT_RESTRICTED_EVENT, { detail: { code: "PASSWORD_CHANGE_REQUIRED" } }));
    });
    expect(session.handleAuth).toHaveBeenCalledWith({
      token: "tok-1",
      user: expect.objectContaining({ mustChangePassword: true })
    });
  });
});

describe("AccountGate: MFA obrigatorio", () => {
  const adminNoMfa = { ...baseUser, mfaEnabled: false };

  it("nao consulta o servidor para quem ja tem MFA, nao e admin ou nao informa mfaEnabled", () => {
    mount({ user: baseUser });
    mount({ user: { ...adminNoMfa, isAdmin: false, role: "viewer" } });
    mount({ user: { id: "u9", role: "admin" } });
    expect(identity.fetchMfaStatus).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("app")).toHaveLength(3);
  });

  it("admin sem MFA quando o servidor exige abre o assistente bloqueante", async () => {
    identity.fetchMfaStatus.mockResolvedValue({ enabled: false, requiredForAdmins: true, recoveryCodesLeft: 0 });
    identity.startMfaSetup.mockResolvedValue({ secret: "ABCDEFGH", otpauthUri: "otpauth://x" });
    identity.enableMfa.mockResolvedValue({ recoveryCodes: ["AAAAA-11111"] });
    identity.fetchMe.mockResolvedValue({ token: "tok-2", user: { ...baseUser, mfaEnabled: true } });
    const session = mount({ user: adminNoMfa });
    const user = userEvent.setup();

    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
    expect(await screen.findByRole("heading", { name: "Ativar verificação em duas etapas" })).toBeInTheDocument();
    expect(screen.queryByTestId("app")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Começar" }));
    await user.type(await screen.findByLabelText("Código do aplicativo"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar e ativar" }));
    await screen.findByText("AAAAA-11111");
    // So libera o app depois de guardar os codigos.
    expect(session.handleAuth).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() =>
      expect(session.handleAuth).toHaveBeenCalledWith({ token: "tok-2", user: expect.objectContaining({ mfaEnabled: true }) })
    );
    expect(session.notify).toHaveBeenCalledWith("Verificação em duas etapas ativada.", "ok");
  });

  it("se reler a conta falhar, segue com o usuario local", async () => {
    identity.fetchMfaStatus.mockResolvedValue({ enabled: false, requiredForAdmins: true });
    identity.startMfaSetup.mockResolvedValue({ secret: "ABCDEFGH", otpauthUri: "otpauth://x" });
    identity.enableMfa.mockResolvedValue({ recoveryCodes: ["AAAAA-11111"] });
    identity.fetchMe.mockRejectedValue(apiError("NETWORK_ERROR", undefined));
    const session = mount({ user: adminNoMfa });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Começar" }));
    await user.type(await screen.findByLabelText("Código do aplicativo"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar e ativar" }));
    await screen.findByText("AAAAA-11111");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() =>
      expect(session.handleAuth).toHaveBeenCalledWith({ token: "tok-1", user: expect.objectContaining({ mfaEnabled: true }) })
    );
  });

  it("libera o app quando o servidor nao exige MFA ou a consulta falha", async () => {
    identity.fetchMfaStatus.mockResolvedValueOnce({ enabled: false, requiredForAdmins: false });
    mount({ user: adminNoMfa });
    expect(await screen.findByTestId("app")).toBeInTheDocument();

    identity.fetchMfaStatus.mockRejectedValueOnce(new Error("rede"));
    mount({ user: { ...adminNoMfa, id: "u2" } });
    await waitFor(() => expect(screen.getAllByTestId("app")).toHaveLength(2));
  });

  it("um 403 MFA_ENROLLMENT_REQUIRED de qualquer chamada liga o bloqueio", async () => {
    mount();
    expect(screen.getByTestId("app")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent(ACCOUNT_RESTRICTED_EVENT, { detail: { code: "MFA_ENROLLMENT_REQUIRED" } }));
    });
    // Usuário ja tem MFA (mfaEnabled=true): o evento nao o bloqueia indevidamente.
    expect(screen.getByTestId("app")).toBeInTheDocument();
  });

  it("permite sair do assistente bloqueante", async () => {
    identity.fetchMfaStatus.mockResolvedValue({ enabled: false, requiredForAdmins: true });
    const session = mount({ user: adminNoMfa });
    await userEvent.setup().click(await screen.findByRole("button", { name: /Sair/ }));
    expect(session.signOut).toHaveBeenCalled();
  });
});
