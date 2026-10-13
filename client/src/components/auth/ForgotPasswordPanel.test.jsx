import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as recovery from "../../api/passwordRecoveryApi.js";
import { apiError } from "../../test/identityHarness.jsx";
import ForgotPasswordPanel from "./ForgotPasswordPanel.jsx";

vi.mock("../../api/passwordRecoveryApi.js");

let onBack;

function setup(props = {}) {
  onBack = vi.fn();
  render(<ForgotPasswordPanel initialEmail="" onBack={onBack} {...props} />);
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  recovery.fetchAuthOptions.mockResolvedValue({ passwordReset: { enabled: true } });
});

describe("Esqueci minha senha", () => {
  it("mostra o formulario, envia o e-mail sem espacos e confirma com mensagem neutra", async () => {
    recovery.requestPasswordReset.mockResolvedValue({ message: "Se o e-mail estiver cadastrado..." });
    const user = setup({ initialEmail: "ana@empresa.com" });

    expect(await screen.findByRole("heading", { name: "Recuperar senha" })).toBeInTheDocument();
    const field = screen.getByLabelText("E-mail");
    expect(field).toHaveValue("ana@empresa.com");
    await user.clear(field);
    await user.type(field, "  maria@empresa.com ");
    await user.click(screen.getByRole("button", { name: "Enviar link de redefinição" }));

    await waitFor(() => expect(recovery.requestPasswordReset).toHaveBeenCalledWith("maria@empresa.com"));
    expect(await screen.findByRole("heading", { name: "Verifique seu e-mail" })).toBeInTheDocument();
    expect(screen.getByText(/Se o e-mail estiver cadastrado/)).toBeInTheDocument();
    expect(screen.getByText(/pasta de spam/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voltar ao login" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("sem e-mail configurado no servidor orienta falar com um administrador (sem formulario)", async () => {
    recovery.fetchAuthOptions.mockResolvedValue({ passwordReset: { enabled: false } });
    setup();

    expect(await screen.findByText(/não está disponível neste servidor/)).toBeInTheDocument();
    expect(screen.getByText(/administrador/)).toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail")).toBeNull();
    expect(recovery.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("se nao conseguir consultar as opcoes, ainda oferece o formulario", async () => {
    recovery.fetchAuthOptions.mockRejectedValue(apiError("NETWORK_ERROR", 0));
    setup();
    expect(await screen.findByLabelText("E-mail")).toBeInTheDocument();
  });

  it("e-mail em branco ou invalido e barrado antes de chamar a API", async () => {
    const user = setup();
    await screen.findByLabelText("E-mail");
    await user.click(screen.getByRole("button", { name: "Enviar link de redefinição" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe um e-mail válido.");

    await user.type(screen.getByLabelText("E-mail"), "isso-nao-e-email");
    await user.click(screen.getByRole("button", { name: "Enviar link de redefinição" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um e-mail válido.");
    expect(recovery.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("excesso de pedidos (429) e falha de rede mostram avisos claros e nao confirmam o envio", async () => {
    const user = setup({ initialEmail: "ana@empresa.com" });
    await screen.findByLabelText("E-mail");

    recovery.requestPasswordReset.mockRejectedValueOnce(apiError(undefined, 429, "Muitas tentativas. Aguarde."));
    await user.click(screen.getByRole("button", { name: "Enviar link de redefinição" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas");
    expect(screen.queryByRole("heading", { name: "Verifique seu e-mail" })).toBeNull();

    recovery.requestPasswordReset.mockRejectedValueOnce(apiError("NETWORK_ERROR", 0));
    await user.click(screen.getByRole("button", { name: "Enviar link de redefinição" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível conectar ao servidor"));
  });

  it("o botao Voltar leva de volta ao login", async () => {
    const user = setup();
    await screen.findByLabelText("E-mail");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalled();
  });
});
