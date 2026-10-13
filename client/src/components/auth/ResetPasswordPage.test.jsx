import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as recovery from "../../api/passwordRecoveryApi.js";
import { apiError } from "../../test/identityHarness.jsx";
import ResetPasswordPage from "./ResetPasswordPage.jsx";

vi.mock("../../api/passwordRecoveryApi.js");

const TOKEN = "A".repeat(43);
const STRONG = "girafa-lanterna-tijolo-sereno";

function setup({ hash = `#token=${TOKEN}` } = {}) {
  window.history.replaceState(null, "", `/redefinir-senha${hash}`);
  render(
    <MemoryRouter initialEntries={["/redefinir-senha"]}>
      <Routes>
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="/login" element={<p>tela de login</p>} />
      </Routes>
    </MemoryRouter>
  );
  return userEvent.setup();
}

async function fill(user, { password = STRONG, confirmation = password } = {}) {
  await user.type(screen.getByLabelText("Nova senha"), password);
  await user.type(screen.getByLabelText("Confirmar nova senha"), confirmation);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Redefinir senha (link do e-mail)", () => {
  it("le o token do fragmento e o remove da barra de enderecos", async () => {
    setup();
    expect(await screen.findByRole("heading", { name: "Escolha uma nova senha" })).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain(TOKEN);
  });

  it("troca a senha, mostra sucesso e leva ao login", async () => {
    recovery.resetPassword.mockResolvedValue({ ok: true });
    const user = setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => expect(recovery.resetPassword).toHaveBeenCalledWith(TOKEN, STRONG));
    expect(await screen.findByRole("heading", { name: "Senha alterada" })).toBeInTheDocument();
    expect(screen.getByText(/verificação em duas etapas/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ir para o login" }));
    expect(await screen.findByText("tela de login")).toBeInTheDocument();
  });

  it("sem token no link mostra link invalido e nao exibe formulario", async () => {
    setup({ hash: "" });
    expect(await screen.findByRole("heading", { name: "Link inválido" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nova senha")).toBeNull();
    expect(screen.getByRole("button", { name: "Pedir um novo link" })).toBeInTheDocument();
  });

  it("token mal formado tambem e tratado como invalido sem chamar a API", async () => {
    setup({ hash: "#token=curto" });
    expect(await screen.findByRole("heading", { name: "Link inválido" })).toBeInTheDocument();
    expect(recovery.resetPassword).not.toHaveBeenCalled();
  });

  it("confirmacao diferente e senha fraca sao barradas localmente", async () => {
    const user = setup();
    await fill(user, { password: STRONG, confirmation: "diferente-demais-123" });
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A confirmação não é igual à nova senha.");

    await user.clear(screen.getByLabelText("Nova senha"));
    await user.clear(screen.getByLabelText("Confirmar nova senha"));
    await fill(user, { password: "curta" });
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/12 caracteres/);
    expect(recovery.resetPassword).not.toHaveBeenCalled();
  });

  it("senha recusada pelo servidor mostra as regras e mantem o formulario (o link segue valido)", async () => {
    recovery.resetPassword.mockRejectedValue(apiError("WEAK_PASSWORD", 400, "fraca", ["Essa senha é muito comum."]));
    const user = setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Essa senha é muito comum.");
    expect(screen.getByLabelText("Nova senha")).toBeInTheDocument();
  });

  it("link expirado ou ja usado (RESET_TOKEN_INVALID) troca para a tela de link invalido", async () => {
    recovery.resetPassword.mockRejectedValue(apiError("RESET_TOKEN_INVALID", 400));
    const user = setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("heading", { name: "Link inválido" })).toBeInTheDocument();
    expect(screen.getByText(/inválido ou expirou/)).toBeInTheDocument();
  });
});
