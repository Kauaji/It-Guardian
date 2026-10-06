import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api.js";
import { AppSessionProvider } from "../context/AppSessionContext.jsx";
import AuthScreen from "../components/auth/AuthScreen.jsx";
import UserMenu from "../components/auth/UserMenu.jsx";
import { renderA11yApp, setupA11yApiMocks, waitForAppReady } from "../test/a11yApp.jsx";
import { renderWithSession } from "../test/identityHarness.jsx";

vi.mock("../api.js");
vi.mock("../api/identityApi.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.join(here, relative), "utf8");

beforeEach(() => setupA11yApiMocks(api));
afterEach(() => cleanup());

describe("estrutura da página (landmarks, título, idioma)", () => {
  it("index.html declara lang pt-BR", () => {
    expect(read("../../index.html")).toMatch(/<html[^>]*lang="pt-BR"/);
  });

  it("tem um único <main>, <header>, <nav> com nome e um único h1", async () => {
    renderA11yApp("/");
    await waitForAppReady();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(document.querySelector("main#conteudo-principal")).toHaveAttribute("tabindex", "-1");
    expect(document.querySelectorAll("header.topbar")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("atualiza document.title a cada rota", async () => {
    const user = userEvent.setup();
    renderA11yApp("/");
    await waitForAppReady();
    expect(document.title).toBe("Dashboard · IT Guardian");
    await user.click(screen.getByRole("button", { name: "Avisos" }));
    await waitFor(() => expect(document.title).toBe("Avisos · IT Guardian"));
    await user.click(screen.getByRole("button", { name: "Ordens de Serviço" }));
    await waitFor(() => expect(document.title).toBe("Ordens de Serviço · IT Guardian"));
  });

  it("a rota /conta/seguranca tem título próprio", async () => {
    renderA11yApp("/conta/seguranca");
    await waitForAppReady();
    await waitFor(() => expect(document.title).toBe("Segurança da conta · IT Guardian"));
  });
});

describe("skip-link e ordem de tab", () => {
  it("o primeiro foco é o link 'Pular para o conteúdo', que leva ao <main>", async () => {
    const user = userEvent.setup();
    renderA11yApp("/");
    await waitForAppReady();
    await user.tab();
    const skip = screen.getByRole("link", { name: "Pular para o conteúdo" });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#conteudo-principal");
    await user.keyboard("{Enter}");
    expect(document.querySelector("main#conteudo-principal")).toHaveFocus();
  });

  it("depois do skip-link, a ordem segue a sidebar e a barra superior antes do conteúdo", async () => {
    const user = userEvent.setup();
    renderA11yApp("/");
    await waitForAppReady();
    const order = [];
    for (let index = 0; index < 8; index += 1) {
      await user.tab();
      order.push(document.activeElement.textContent.trim() || document.activeElement.getAttribute("aria-label") || document.activeElement.title);
    }
    expect(order[0]).toBe("Pular para o conteúdo");
    expect(order[1]).toMatch(/IT Guardian/);
    expect(order.slice(2, 6)).toEqual(["Dashboard", "Avisos", "Ordens de Serviço", "Agenda Técnica"]);
  });

  it("CSS: o skip-link só aparece ao focar e o anel de foco global existe", () => {
    const css = read("../styles/runtime-recovery-a11y.css");
    expect(css).toMatch(/\.skip-link\s*\{[^}]*translateY\(-200%\)/);
    expect(css).toMatch(/\.skip-link:focus[^{]*\{[^}]*translateY\(0\)/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--focus-outline\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*animation-duration:\s*0\.01ms/);
  });
});

describe("login: ordem de tab", () => {
  it("alterna modo, e-mail, senha e envio", async () => {
    const user = userEvent.setup();
    render(<AuthScreen onAuth={vi.fn()} notify={vi.fn()} />);
    const email = await screen.findByLabelText("E-mail");
    expect(email).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Senha")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Acessar painel" })).toHaveFocus();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(email).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: /Cadastro/ })).toHaveFocus();
  });
});

describe("modais: Escape fecha e devolve o foco ao disparador", () => {
  it("detalhe da OS", async () => {
    const user = userEvent.setup();
    renderA11yApp("/ordens-de-servico");
    await waitForAppReady("OS-001");
    const trigger = screen.getAllByText("OS-001")[0].closest("button");
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("configurações gerais", async () => {
    const user = userEvent.setup();
    renderA11yApp("/");
    await waitForAppReady();
    const trigger = screen.getByRole("button", { name: /Configurações/ });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("ficha da máquina prende o foco (Tab e Shift+Tab não saem do diálogo)", async () => {
    const user = userEvent.setup();
    renderA11yApp("/inventario");
    await waitForAppReady("PC-01");
    const trigger = screen.getAllByRole("button", { name: "Ficha" })[0];
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    for (let index = 0; index < 40; index += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

describe("menu da conta (UserMenu)", () => {
  function mountMenu() {
    const { session } = renderWithSession(null);
    render(
      <MemoryRouter>
        <AppSessionProvider value={session}>
          <UserMenu />
        </AppSessionProvider>
      </MemoryRouter>
    );
  }

  it("abre com seta abaixo, foca o primeiro item, navega por setas/Home/End e fecha com Escape devolvendo o foco", async () => {
    const user = userEvent.setup();
    mountMenu();
    const button = screen.getByRole("button", { name: "Minha conta" });
    button.focus();
    await user.keyboard("{ArrowDown}");
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[items.length > 1 ? 1 : 0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(items.at(-1)).toHaveFocus();
    await user.keyboard("{Home}");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(items.at(-1)).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
