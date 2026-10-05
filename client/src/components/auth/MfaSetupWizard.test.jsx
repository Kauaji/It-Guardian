import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as identity from "../../api/identityApi.js";
import { copyText, downloadTextFile } from "../../auth/clipboard.js";
import { generateQrDataUrl } from "../../auth/qrCode.js";
import { apiError } from "../../test/identityHarness.jsx";
import MfaSetupWizard from "./MfaSetupWizard.jsx";

vi.mock("../../api/identityApi.js");
vi.mock("../../auth/qrCode.js");
vi.mock("../../auth/clipboard.js");

const setupData = { secret: "JBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/IT%20Guardian:ana?secret=JBSWY3DPEHPK3PXP" };

beforeEach(() => {
  vi.clearAllMocks();
  identity.startMfaSetup.mockResolvedValue(setupData);
  generateQrDataUrl.mockResolvedValue("data:image/png;base64,QR");
  copyText.mockResolvedValue(true);
});

function setup(props = {}) {
  const onComplete = vi.fn();
  const onCancel = vi.fn();
  render(<MfaSetupWizard token="tok-1" onComplete={onComplete} onCancel={onCancel} {...props} />);
  return { onComplete, onCancel, user: userEvent.setup() };
}

describe("MfaSetupWizard", () => {
  it("fluxo completo: segredo, QR, confirmacao, codigos de recuperacao e conclusao", async () => {
    identity.enableMfa.mockResolvedValue({ recoveryCodes: ["AAAAA-11111", "BBBBB-22222"] });
    const { onComplete, user } = setup();

    expect(screen.getByRole("heading", { name: "Ativar verificação em duas etapas" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Começar" }));

    const qr = await screen.findByAltText(/QR code/);
    expect(qr).toHaveAttribute("src", "data:image/png;base64,QR");
    expect(generateQrDataUrl).toHaveBeenCalledWith(setupData.otpauthUri);
    expect(screen.getByLabelText("Chave de configuração")).toHaveTextContent("JBSW Y3DP EHPK 3PXP");

    await user.click(screen.getByRole("button", { name: /Copiar chave/ }));
    expect(copyText).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP");
    expect(await screen.findByRole("button", { name: /Copiada/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Código do aplicativo"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar e ativar" }));

    expect(await screen.findByText("AAAAA-11111")).toBeInTheDocument();
    expect(identity.enableMfa).toHaveBeenCalledWith("tok-1", "123456");
    expect(screen.getByText(/aparecem só agora/)).toBeInTheDocument();
    // O segredo some da tela depois de ativar.
    expect(screen.queryByLabelText("Chave de configuração")).not.toBeInTheDocument();

    const done = screen.getByRole("button", { name: "Concluir" });
    expect(done).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Guardei os códigos/ }));
    await user.click(done);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("AAAAA-11111")).not.toBeInTheDocument();
  });

  it("copia e baixa os codigos de recuperacao", async () => {
    identity.enableMfa.mockResolvedValue({ recoveryCodes: ["AAAAA-11111", "BBBBB-22222"] });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Começar" }));
    await user.type(await screen.findByLabelText("Código do aplicativo"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar e ativar" }));
    await screen.findByText("AAAAA-11111");

    await user.click(screen.getByRole("button", { name: /Copiar códigos/ }));
    expect(copyText).toHaveBeenLastCalledWith("AAAAA-11111\nBBBBB-22222");
    expect(await screen.findByRole("status")).toHaveTextContent("Códigos copiados");

    copyText.mockResolvedValue(false);
    await user.click(screen.getByRole("button", { name: /Copiar códigos/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível copiar");

    await user.click(screen.getByRole("button", { name: /Baixar/ }));
    expect(downloadTextFile).toHaveBeenCalledWith(
      "it-guardian-codigos-de-recuperacao.txt",
      expect.stringContaining("AAAAA-11111\nBBBBB-22222")
    );
  });

  it("codigo errado mantem o passo e limpa o campo; codigo curto nao chama o servidor", async () => {
    identity.enableMfa.mockRejectedValue(apiError("MFA_CODE_INVALID", 400));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Começar" }));
    const input = await screen.findByLabelText("Código do aplicativo");

    await user.type(input, "12");
    await user.click(screen.getByRole("button", { name: "Confirmar e ativar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Digite os 6 dígitos do código.");
    expect(identity.enableMfa).not.toHaveBeenCalled();

    await user.type(input, "3456");
    await user.click(screen.getByRole("button", { name: "Confirmar e ativar" }));
    await waitFor(() => expect(identity.enableMfa).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido.");
    expect(input).toHaveValue("");
  });

  it("configuracao nao iniciada volta ao primeiro passo", async () => {
    identity.enableMfa.mockRejectedValue(apiError("MFA_SETUP_NOT_STARTED", 400));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Começar" }));
    await user.type(await screen.findByLabelText("Código do aplicativo"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar e ativar" }));
    expect(await screen.findByRole("button", { name: "Começar" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Comece de novo.");
  });

  it("erro ao gerar o segredo e cancelamento", async () => {
    identity.startMfaSetup.mockRejectedValue(apiError("MFA_ALREADY_ENABLED", 409));
    const { onCancel, user } = setup();
    await user.click(screen.getByRole("button", { name: "Começar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("já está ativa");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("se o QR falhar, a chave manual continua disponivel", async () => {
    generateQrDataUrl.mockRejectedValue(new Error("falhou"));
    const { user } = setup({ onCancel: undefined });
    await user.click(screen.getByRole("button", { name: "Começar" }));
    expect(await screen.findByText(/Não foi possível gerar o QR code/)).toBeInTheDocument();
    expect(screen.getByLabelText("Chave de configuração")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });

  it("copiar a chave sem permissao nao marca como copiada", async () => {
    copyText.mockResolvedValue(false);
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Começar" }));
    await user.click(await screen.findByRole("button", { name: /Copiar chave/ }));
    expect(screen.getByRole("button", { name: /Copiar chave/ })).toBeInTheDocument();
  });
});
