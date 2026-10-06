import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CloudAdminHeader from "./CloudAdminHeader.jsx";

describe("CloudAdminHeader", () => {
  it("com URL mostra o link de download", () => {
    render(<CloudAdminHeader installerUrl="https://exemplo.test/setup.exe" />);
    const link = screen.getByRole("link", { name: /Baixar instalador/ });
    expect(link).toHaveAttribute("href", "https://exemplo.test/setup.exe");
  });

  it("sem URL mostra o botao desabilitado com a dica de configuracao", () => {
    render(<CloudAdminHeader installerUrl="" />);
    const button = screen.getByRole("button", { name: /Instalador indisponível/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Defina VITE_COLLECTOR_INSTALLER_URL no build do frontend.");
  });
});
