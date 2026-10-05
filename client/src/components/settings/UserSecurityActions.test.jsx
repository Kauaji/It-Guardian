import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as identity from "../../api/identityApi.js";
import { copyText } from "../../auth/clipboard.js";
import { apiError } from "../../test/identityHarness.jsx";
import UserSecurityActions from "./UserSecurityActions.jsx";

vi.mock("../../api/identityApi.js");
vi.mock("../../auth/clipboard.js");

const target = { id: "u2", name: "Bruno", email: "bruno@empresa.com", mfaEnabled: true };
let notify;

function mount(props = {}) {
  notify = vi.fn();
  render(<UserSecurityActions token="tok-1" target={target} currentUserId="u1" notify={notify} {...props} />);
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  copyText.mockResolvedValue(true);
});

describe("UserSecurityActions", () => {
  it("nao aparece para a propria conta nem sem alvo", () => {
    const { container } = render(<UserSecurityActions token="t" target={target} currentUserId="u2" notify={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    const empty = render(<UserSecurityActions token="t" target={null} notify={vi.fn()} />);
    expect(empty.container).toBeEmptyDOMElement();
  });

  it("redefinir senha: confirma, mostra a senha temporaria uma vez e permite copiar", async () => {
    identity.adminResetPassword.mockResolvedValue({ temporaryPassword: "Tmp-Senha-12345", user: target });
    const user = mount();

    await user.click(screen.getByRole("button", { name: "Redefinir senha de Bruno" }));
    const dialog = screen.getByRole("alertdialog", { name: "Redefinir senha" });
    expect(dialog).toHaveTextContent("Todas as sessões da pessoa serão encerradas");
    expect(identity.adminResetPassword).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Gerar senha temporária" }));
    expect(await screen.findByLabelText("Senha temporária")).toHaveTextContent("Tmp-Senha-12345");
    expect(identity.adminResetPassword).toHaveBeenCalledWith("tok-1", "u2");
    expect(screen.getByText(/aparece só agora/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Copiar/ }));
    expect(copyText).toHaveBeenCalledWith("Tmp-Senha-12345");
    expect(await screen.findByRole("button", { name: /Copiada/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Tmp-Senha-12345")).not.toBeInTheDocument();
  });

  it("falha ao copiar orienta copiar manualmente", async () => {
    copyText.mockResolvedValue(false);
    identity.adminResetPassword.mockResolvedValue({ temporaryPassword: "Tmp-Senha-12345" });
    const user = mount();
    await user.click(screen.getByRole("button", { name: "Redefinir senha de Bruno" }));
    await user.click(screen.getByRole("button", { name: "Gerar senha temporária" }));
    await user.click(await screen.findByRole("button", { name: /Copiar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível copiar");
  });

  it("cancelar nao chama o servidor e Escape fecha o dialogo", async () => {
    const user = mount();
    await user.click(screen.getByRole("button", { name: "Redefinir senha de Bruno" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Redefinir senha de Bruno" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(identity.adminResetPassword).not.toHaveBeenCalled();
  });

  it("erro do servidor aparece no dialogo", async () => {
    identity.adminResetPassword.mockRejectedValue(apiError(undefined, 404, "Usuário não encontrado."));
    const user = mount();
    await user.click(screen.getByRole("button", { name: "Redefinir senha de Bruno" }));
    await user.click(screen.getByRole("button", { name: "Gerar senha temporária" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Usuário não encontrado.");
  });

  it("redefinir MFA exige confirmacao e avisa o admin", async () => {
    identity.adminResetMfa.mockResolvedValue({});
    const user = mount();
    await user.click(screen.getByRole("button", { name: "Redefinir MFA de Bruno" }));
    expect(screen.getByRole("alertdialog", { name: "Redefinir MFA" })).toHaveTextContent("perdeu o aparelho");
    await user.click(screen.getByRole("button", { name: "Remover MFA" }));

    await waitFor(() => expect(identity.adminResetMfa).toHaveBeenCalledWith("tok-1", "u2"));
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("MFA de Bruno removido"), "ok");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("so oferece redefinir MFA quando a pessoa tem MFA e respeita 'disabled'", () => {
    mount({ target: { ...target, mfaEnabled: false }, disabled: true });
    expect(screen.queryByRole("button", { name: /Redefinir MFA/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Redefinir senha/ })).toBeDisabled();
  });
});
