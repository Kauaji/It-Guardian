import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as identity from "../../api/identityApi.js";
import { apiError } from "../../test/identityHarness.jsx";
import AuthScreen from "./AuthScreen.jsx";

vi.mock("../../api/identityApi.js");

const session = { user: { id: "u1", name: "Ana" }, token: "tok" };
let onAuth;
let notify;

function setup() {
  onAuth = vi.fn();
  notify = vi.fn();
  render(<AuthScreen onAuth={onAuth} notify={notify} />);
  return userEvent.setup();
}

async function fillLogin(user, { email = "ana@empresa.com", password = "senha-correta-123" } = {}) {
  await user.clear(screen.getByLabelText("E-mail"));
  await user.type(screen.getByLabelText("E-mail"), email);
  await user.clear(screen.getByLabelText("Senha"));
  await user.type(screen.getByLabelText("Senha"), password);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("login simples", () => {
  it("entra, avisa o app e usa os autocompletes corretos", async () => {
    identity.login.mockResolvedValue(session);
    const user = setup();

    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");

    await fillLogin(user);
    await user.click(screen.getByRole("button", { name: "Acessar painel" }));

    await waitFor(() => expect(onAuth).toHaveBeenCalledWith(session));
    expect(identity.login).toHaveBeenCalledWith({ email: "ana@empresa.com", password: "senha-correta-123" });
    expect(notify).toHaveBeenCalledWith("Login realizado com sucesso.", "ok");
  });

  it("credenciais invalidas mostram mensagem generica anunciada (role=alert)", async () => {
    identity.login.mockRejectedValue(apiError("INVALID_CREDENTIALS"));
    const user = setup();
    await fillLogin(user);
    await user.click(screen.getByRole("button", { name: "Acessar painel" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
    expect(onAuth).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Senha")).toHaveFocus();
  });

  it("401 sem codigo (servidor antigo) tambem vira credencial invalida", async () => {
    identity.login.mockRejectedValue(apiError(undefined, 401, "Invalid"));
    const user = setup();
    await fillLogin(user);
    await user.click(screen.getByRole("button", { name: "Acessar painel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
  });

  it("conta bloqueada mostra o aviso de tentativas", async () => {
    identity.login.mockRejectedValue(apiError("ACCOUNT_LOCKED", 429));
    const user = setup();
    await fillLogin(user);
    await user.click(screen.getByRole("button", { name: "Acessar painel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas. Aguarde alguns minutos");
  });
});

describe("login com MFA", () => {
  beforeEach(() => {
    identity.login.mockResolvedValue({ mfaRequired: true, mfaToken: "mfa-1" });
  });

  async function reachMfaStep(user) {
    await fillLogin(user);
    await user.click(screen.getByRole("button", { name: "Acessar painel" }));
    return screen.findByLabelText("Código de 6 dígitos");
  }

  it("abre o passo do codigo com foco, teclado numerico e one-time-code", async () => {
    const user = setup();
    const input = await reachMfaStep(user);

    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(screen.getByRole("heading", { name: "Verificação em duas etapas" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  it("conclui com o codigo de 6 digitos (ignora letras e espacos)", async () => {
    identity.loginMfa.mockResolvedValue(session);
    const user = setup();
    const input = await reachMfaStep(user);

    await user.type(input, "12a3 456");
    expect(input).toHaveValue("123456");
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    await waitFor(() => expect(onAuth).toHaveBeenCalledWith(session));
    expect(identity.loginMfa).toHaveBeenCalledWith({ mfaToken: "mfa-1", code: "123456" });
    expect(notify).toHaveBeenCalledWith("Login realizado com sucesso.", "ok");
  });

  it("codigo incompleto nao chama o servidor", async () => {
    const user = setup();
    const input = await reachMfaStep(user);
    await user.type(input, "123");
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Digite os 6 dígitos do código.");
    expect(identity.loginMfa).not.toHaveBeenCalled();
  });

  it("codigo errado mostra erro, limpa o campo e devolve o foco", async () => {
    identity.loginMfa.mockRejectedValue(apiError("MFA_CODE_INVALID"));
    const user = setup();
    const input = await reachMfaStep(user);
    await user.type(input, "000000");
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido.");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onAuth).not.toHaveBeenCalled();
  });

  it("alterna para o codigo de recuperacao e envia recoveryCode", async () => {
    identity.loginMfa.mockResolvedValue(session);
    const user = setup();
    await reachMfaStep(user);

    await user.click(screen.getByRole("button", { name: "Usar código de recuperação" }));
    const recovery = screen.getByLabelText("Código de recuperação");
    expect(recovery).toHaveFocus();
    await user.type(recovery, "abcde-fghjk");
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    await waitFor(() => expect(onAuth).toHaveBeenCalled());
    expect(identity.loginMfa).toHaveBeenCalledWith({ mfaToken: "mfa-1", recoveryCode: "ABCDE-FGHJK" });
  });

  it("recuperacao vazia pede o codigo e da para voltar ao codigo do app", async () => {
    const user = setup();
    await reachMfaStep(user);
    await user.click(screen.getByRole("button", { name: "Usar código de recuperação" }));
    await user.click(screen.getByRole("button", { name: "Verificar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe um código de recuperação.");

    await user.click(screen.getByRole("button", { name: "Usar código do aplicativo" }));
    expect(screen.getByLabelText("Código de 6 dígitos")).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("desafio expirado volta para e-mail e senha com aviso", async () => {
    identity.loginMfa.mockRejectedValue(apiError("MFA_CHALLENGE_INVALID"));
    const user = setup();
    const input = await reachMfaStep(user);
    await user.type(input, "123456");
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    expect(await screen.findByRole("status")).toHaveTextContent("A verificação expirou.");
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@empresa.com");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.getByLabelText("Senha")).toHaveFocus();
  });

  it("bloqueio no passo do codigo mostra o aviso de tentativas", async () => {
    identity.loginMfa.mockRejectedValue(apiError("ACCOUNT_LOCKED", 429));
    const user = setup();
    const input = await reachMfaStep(user);
    await user.type(input, "123456");
    await user.click(screen.getByRole("button", { name: "Verificar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas. Aguarde alguns minutos");
  });

  it("voltar retorna ao formulario de credenciais", async () => {
    const user = setup();
    await reachMfaStep(user);
    await user.click(screen.getByRole("button", { name: /Voltar/ }));
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@empresa.com");
  });
});

describe("cadastro", () => {
  async function openRegister(user) {
    await user.click(screen.getByRole("button", { name: "Cadastro" }));
  }

  it("valida a politica localmente antes de chamar o servidor", async () => {
    const user = setup();
    await openRegister(user);
    await user.type(screen.getByLabelText("Nome"), "Ana");
    await user.type(screen.getByLabelText("Senha"), "curta");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos 12 caracteres");
    expect(identity.register).not.toHaveBeenCalled();
  });

  it("cria a conta enviando o token de configuracao e usa new-password", async () => {
    identity.register.mockResolvedValue(session);
    const user = setup();
    await openRegister(user);

    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "new-password");
    await user.type(screen.getByLabelText("Nome"), "Ana");
    await user.clear(screen.getByLabelText("E-mail"));
    await user.type(screen.getByLabelText("E-mail"), "ana@empresa.com");
    await user.type(screen.getByLabelText("Senha"), "cavalo azul come batata");
    await user.type(screen.getByLabelText(/Token de configuração inicial/), " setup-1 ");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => expect(onAuth).toHaveBeenCalledWith(session));
    expect(identity.register).toHaveBeenCalledWith({
      name: "Ana",
      email: "ana@empresa.com",
      password: "cavalo azul come batata",
      setupToken: "setup-1"
    });
    expect(notify).toHaveBeenCalledWith("Conta criada com sucesso.", "ok");
  });

  it("mostra todas as regras quando o servidor recusa a senha", async () => {
    identity.register.mockRejectedValue(apiError("WEAK_PASSWORD", 400, "x", ["Muito comum.", "Contém seu nome."]));
    const user = setup();
    await openRegister(user);
    await user.type(screen.getByLabelText("Senha"), "cavalo azul come batata");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Muito comum.");
    expect(alert).toHaveTextContent("Contém seu nome.");
  });

  it("explica cadastro desativado e token invalido", async () => {
    identity.register.mockRejectedValueOnce(apiError("SETUP_DISABLED", 403));
    const user = setup();
    await openRegister(user);
    await user.type(screen.getByLabelText("Senha"), "cavalo azul come batata");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cadastro inicial pela internet está desativado");

    identity.register.mockRejectedValueOnce(apiError("SETUP_TOKEN_INVALID", 403));
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Token de configuração inicial inválido."));
  });
});
