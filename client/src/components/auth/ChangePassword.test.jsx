import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as identity from "../../api/identityApi.js";
import { apiError, baseUser } from "../../test/identityHarness.jsx";
import ChangePasswordForm from "./ChangePasswordForm.jsx";
import ForcedPasswordChange from "./ForcedPasswordChange.jsx";

vi.mock("../../api/identityApi.js");

const newSession = { token: "tok-2", user: { ...baseUser, mustChangePassword: false } };
const goodPassword = "cavalo azul come batata";

async function fill(user, { current = "senha-antiga-123", next = goodPassword, confirmation = next } = {}) {
  if (current) await user.type(screen.getByLabelText("Senha atual"), current);
  if (next) await user.type(screen.getByLabelText("Nova senha"), next);
  if (confirmation) await user.type(screen.getByLabelText("Confirmar nova senha"), confirmation);
  await user.click(screen.getByRole("button", { name: /Trocar senha/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ChangePasswordForm", () => {
  function setup() {
    const onChanged = vi.fn();
    render(<ChangePasswordForm token="tok-1" user={baseUser} onChanged={onChanged} />);
    return { onChanged, user: userEvent.setup() };
  }

  it("usa os autocompletes corretos e associa um campo username oculto", () => {
    setup();
    expect(screen.getByLabelText("Senha atual")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("Nova senha")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Confirmar nova senha")).toHaveAttribute("autocomplete", "new-password");
    expect(document.querySelector('input[autocomplete="username"]')).toHaveValue("ana@empresa.com");
  });

  it("troca a senha e entrega a sessao nova", async () => {
    identity.changePassword.mockResolvedValue(newSession);
    const { onChanged, user } = setup();
    await fill(user);

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(newSession));
    expect(identity.changePassword).toHaveBeenCalledWith("tok-1", {
      currentPassword: "senha-antiga-123",
      newPassword: goodPassword
    });
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
  });

  it("mostra checklist e forca enquanto digita, e avisa quando a confirmacao difere", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Nova senha"), "curta");
    expect(screen.getByText("Pelo menos 12 caracteres").closest("li")).not.toHaveClass("met");
    expect(screen.getByText("Força: Muito curta")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Nova senha"));
    await user.type(screen.getByLabelText("Nova senha"), goodPassword);
    expect(screen.getByText("Pelo menos 12 caracteres").closest("li")).toHaveClass("met");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "3");

    await user.type(screen.getByLabelText("Confirmar nova senha"), "outra");
    expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
  });

  it("valida localmente: senha atual, politica, igualdade e confirmacao", async () => {
    const { onChanged, user } = setup();

    await fill(user, { current: "", next: "", confirmation: "" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe a senha atual.");
    expect(screen.getByLabelText("Senha atual")).toHaveFocus();

    await user.type(screen.getByLabelText("Senha atual"), "senha-antiga-123");
    await user.type(screen.getByLabelText("Nova senha"), "curta");
    await user.click(screen.getByRole("button", { name: "Trocar senha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos 12 caracteres");
    expect(screen.getByLabelText("Nova senha")).toHaveFocus();

    await user.clear(screen.getByLabelText("Nova senha"));
    await user.type(screen.getByLabelText("Nova senha"), "senha-antiga-123");
    await user.click(screen.getByRole("button", { name: "Trocar senha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("precisa ser diferente da atual");

    await user.clear(screen.getByLabelText("Nova senha"));
    await user.type(screen.getByLabelText("Nova senha"), goodPassword);
    await user.type(screen.getByLabelText("Confirmar nova senha"), "diferente");
    await user.click(screen.getByRole("button", { name: "Trocar senha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A confirmação não é igual");

    expect(identity.changePassword).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("senha atual errada devolve o foco para o campo da senha atual", async () => {
    identity.changePassword.mockRejectedValue(apiError("CURRENT_PASSWORD_INVALID"));
    const { user } = setup();
    await fill(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("A senha atual está incorreta.");
    expect(screen.getByLabelText("Senha atual")).toHaveFocus();
  });

  it("mostra todas as regras de senha fraca e a reutilizacao", async () => {
    identity.changePassword.mockRejectedValueOnce(apiError("WEAK_PASSWORD", 400, "x", ["Muito comum.", "Outra regra."]));
    const { user } = setup();
    await fill(user);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Muito comum.");
    expect(alert).toHaveTextContent("Outra regra.");

    identity.changePassword.mockRejectedValueOnce(apiError("PASSWORD_REUSED", 400));
    await user.click(screen.getByRole("button", { name: "Trocar senha" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("precisa ser diferente da atual"));
  });
});

describe("ForcedPasswordChange", () => {
  it("e bloqueante: so troca de senha ou sair, com foco no titulo", async () => {
    const onSignOut = vi.fn();
    render(<ForcedPasswordChange token="tok-1" user={baseUser} onChanged={vi.fn()} onSignOut={onSignOut} />);
    const title = screen.getByRole("heading", { name: "Troque a senha para continuar" });
    expect(title).toHaveFocus();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: /Sair/ }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
