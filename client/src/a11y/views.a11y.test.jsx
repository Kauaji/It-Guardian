import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import * as api from "../api.js";
import { renderA11yApp, setupA11yApiMocks, waitForAppReady } from "../test/a11yApp.jsx";
import { expectNoAxeViolations } from "../test/axe.js";

vi.mock("../api.js");

// Axe (WCAG 2.1 A/AA) sobre as visoes REAIS montadas com dados mockados.
// Espelha tests/e2e/a11y.spec.js (navegador). `color-contrast` nao roda no jsdom: ver contrast.views.test.jsx.
beforeEach(() => setupA11yApiMocks(api));
afterEach(() => cleanup());

const views = [
  ["dashboard", "/", null],
  ["avisos", "/avisos", "Sugestões de OS"],
  ["ordens de serviço", "/ordens-de-servico", "OS-001"],
  ["agenda", "/agenda", "Planejamento operacional"],
  ["peças", "/pecas", "Itens rastreados"],
  ["inventário", "/inventario", "PC-01"]
];

describe("telas principais", () => {
  for (const [name, path, marker] of views) {
    it(`${name}: sem violações axe (WCAG 2.1 A/AA)`, async () => {
      renderA11yApp(path);
      await waitForAppReady(marker);
      await expectNoAxeViolations();
    }, 40000);
  }
});

describe("modais principais", () => {
  it("detalhe da OS", async () => {
    const user = userEvent.setup();
    renderA11yApp("/ordens-de-servico");
    await waitForAppReady("OS-001");
    await user.click(screen.getAllByText("OS-001")[0].closest("button"));
    await screen.findByRole("dialog");
    await expectNoAxeViolations();
  }, 40000);

  it("configurações gerais", async () => {
    const user = userEvent.setup();
    renderA11yApp("/");
    await waitForAppReady();
    await user.click(screen.getByRole("button", { name: /Configurações/ }));
    await screen.findByRole("dialog");
    await expectNoAxeViolations();
  }, 40000);

  it("ficha da máquina", async () => {
    const user = userEvent.setup();
    renderA11yApp("/inventario");
    await waitForAppReady("PC-01");
    await user.click(screen.getAllByRole("button", { name: "Ficha" })[0]);
    await screen.findByRole("dialog");
    await expectNoAxeViolations();
  }, 40000);
});
