import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import * as identity from "../api/identityApi.js";
import * as recovery from "../api/passwordRecoveryApi.js";
import { generateQrDataUrl } from "../auth/qrCode.js";
import { copyText } from "../auth/clipboard.js";
import AccountSecurityPage from "../components/auth/AccountSecurityPage.jsx";
import AuthScreen from "../components/auth/AuthScreen.jsx";
import ForcedPasswordChange from "../components/auth/ForcedPasswordChange.jsx";
import ResetPasswordPage from "../components/auth/ResetPasswordPage.jsx";
import MfaEnrollmentGate from "../components/auth/MfaEnrollmentGate.jsx";
import UserMenu from "../components/auth/UserMenu.jsx";
import { baseUser, renderWithSession } from "../test/identityHarness.jsx";
import { expectNoAxeViolations } from "../test/axe.js";

vi.mock("../api/identityApi.js");
vi.mock("../api/passwordRecoveryApi.js");
vi.mock("../auth/qrCode.js");
vi.mock("../auth/clipboard.js");

// Fluxo de identidade (login, MFA, troca obrigatoria, cadastro de MFA, seguranca da conta).
beforeEach(() => {
  vi.clearAllMocks();
  generateQrDataUrl.mockResolvedValue("data:image/png;base64,QR");
  copyText.mockResolvedValue(true);
  identity.startMfaSetup.mockResolvedValue({ secret: "JBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP" });
  identity.fetchSessions.mockResolvedValue([
    {
      id: "s1",
      current: true,
      ip: "10.0.0.1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0",
      lastSeenAt: "2026-10-02T12:00:00Z",
      createdAt: "2026-10-02T10:00:00Z"
    },
    {
      id: "s2",
      current: false,
      ip: "10.0.0.2",
      userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile",
      lastSeenAt: "2026-10-01T12:00:00Z",
      createdAt: "2026-10-01T10:00:00Z"
    }
  ]);
  identity.fetchMfaStatus.mockResolvedValue({ enabled: false, requiredForAdmins: false, recoveryCodesLeft: 0 });
});
afterEach(() => cleanup());

describe("telas de identidade: axe WCAG 2.1 A/AA", () => {
  it("login", async () => {
    render(<AuthScreen onAuth={vi.fn()} notify={vi.fn()} />);
    await screen.findByLabelText("E-mail");
    await expectNoAxeViolations();
  });

  it("esqueci minha senha (formulario, confirmacao e servidor sem e-mail)", async () => {
    recovery.fetchAuthOptions.mockResolvedValue({ passwordReset: { enabled: true } });
    recovery.requestPasswordReset.mockResolvedValue({ message: "ok" });
    const user = userEvent.setup();
    render(<AuthScreen onAuth={vi.fn()} notify={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    const emailField = await screen.findByLabelText("E-mail");
    await user.clear(emailField); // em dev a tela vem preenchida com o e-mail demo
    await user.type(emailField, "ana@empresa.com");
    await expectNoAxeViolations();

    await user.click(screen.getByRole("button", { name: "Enviar link de redefinição" }));
    await screen.findByRole("heading", { name: "Verifique seu e-mail" });
    await expectNoAxeViolations();

    cleanup();
    recovery.fetchAuthOptions.mockResolvedValue({ passwordReset: { enabled: false } });
    render(<AuthScreen onAuth={vi.fn()} notify={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    await screen.findByText(/não está disponível neste servidor/);
    await expectNoAxeViolations();
  });

  it("redefinir senha pelo link do e-mail (formulario, erro e link invalido)", async () => {
    window.history.replaceState(null, "", "/redefinir-senha#token=" + "C".repeat(43));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Escolha uma nova senha" });
    await expectNoAxeViolations();

    await user.type(screen.getByLabelText("Nova senha"), "curta");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    await screen.findByRole("alert");
    await expectNoAxeViolations();

    cleanup();
    window.history.replaceState(null, "", "/redefinir-senha");
    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Link inválido" });
    await expectNoAxeViolations();
  });

  it("cadastro do primeiro administrador", async () => {
    const user = userEvent.setup();
    render(<AuthScreen onAuth={vi.fn()} notify={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Cadastro/ }));
    await screen.findByLabelText("Nome");
    await expectNoAxeViolations();
  });

  it("login com erro anunciado", async () => {
    const user = userEvent.setup();
    identity.login.mockRejectedValue(Object.assign(new Error("x"), { code: "INVALID_CREDENTIALS", statusCode: 401 }));
    render(<AuthScreen onAuth={vi.fn()} notify={vi.fn()} />);
    await user.type(screen.getByLabelText("Senha"), "errada-123");
    await user.click(screen.getByRole("button", { name: "Acessar painel" }));
    await screen.findByRole("alert");
    await expectNoAxeViolations();
  });

  it("passo do código MFA", async () => {
    const user = userEvent.setup();
    identity.login.mockResolvedValue({ mfaRequired: true, mfaToken: "mfa-1" });
    render(<AuthScreen onAuth={vi.fn()} notify={vi.fn()} />);
    await user.type(screen.getByLabelText("Senha"), "senha-correta-123");
    await user.click(screen.getByRole("button", { name: "Acessar painel" }));
    await screen.findByLabelText("Código de 6 dígitos");
    await expectNoAxeViolations();
  });

  it("troca obrigatória de senha", async () => {
    render(<ForcedPasswordChange token="t" user={baseUser} onChanged={vi.fn()} onSignOut={vi.fn()} />);
    await screen.findByRole("heading", { name: "Troque a senha para continuar" });
    await expectNoAxeViolations();
  });

  it("cadastro obrigatório de MFA (assistente)", async () => {
    const user = userEvent.setup();
    render(<MfaEnrollmentGate token="t" onComplete={vi.fn()} onSignOut={vi.fn()} />);
    await screen.findByRole("button", { name: "Começar" });
    await expectNoAxeViolations();
    await user.click(screen.getByRole("button", { name: "Começar" }));
    await screen.findByAltText(/QR code/);
    await expectNoAxeViolations();
  });

  it("/conta/seguranca", async () => {
    const { tree } = renderWithSession(<AccountSecurityPage />, {
      user: { ...baseUser, isAdmin: false, role: "viewer" },
      path: "/conta/seguranca"
    });
    render(tree);
    await screen.findByRole("list", { name: "Sessões ativas" });
    await waitFor(() => screen.getByText(/Desativada\./));
    await expectNoAxeViolations();
  });

  it("menu da conta aberto", async () => {
    const user = userEvent.setup();
    const { session } = renderWithSession(null);
    const { AppSessionProvider } = await import("../context/AppSessionContext.jsx");
    render(
      <MemoryRouter>
        <AppSessionProvider value={session}>
          <UserMenu />
        </AppSessionProvider>
      </MemoryRouter>
    );
    await user.click(screen.getByRole("button", { name: "Minha conta" }));
    await screen.findByRole("menu");
    await expectNoAxeViolations();
  });
});
