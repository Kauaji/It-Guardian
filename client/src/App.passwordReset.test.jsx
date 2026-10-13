import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api.js";
import * as recovery from "./api/passwordRecoveryApi.js";
import App from "./App.jsx";

vi.mock("./api.js");
vi.mock("./api/passwordRecoveryApi.js");

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("App: /redefinir-senha e publica", () => {
  it("abre a pagina de redefinicao sem restaurar sessao nem ir para o login", async () => {
    window.history.replaceState(null, "", "/redefinir-senha#token=" + "B".repeat(43));
    render(
      <MemoryRouter initialEntries={["/redefinir-senha"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Escolha uma nova senha" })).toBeInTheDocument();
    expect(api.fetchAuthSession).not.toHaveBeenCalled();
    expect(recovery.resetPassword).not.toHaveBeenCalled();
  });
});
