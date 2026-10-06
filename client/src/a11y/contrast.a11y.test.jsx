import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import * as api from "../api.js";
import { renderA11yApp, setupA11yApiMocks, waitForAppReady } from "../test/a11yApp.jsx";
import { modalScenarios, tabScenarios, viewScenarios } from "../test/a11yScenarios.js";
import { expectNoContrastFailures } from "../test/axe.js";

vi.mock("../api.js");

// Contraste WCAG (4.5:1 texto normal, 3:1 texto grande) de todo texto visivel das visoes reais,
// calculado com as folhas de estilo reais nos temas claro e escuro (ver test/contrastAudit.js).
beforeEach(() => setupA11yApiMocks(api));
afterEach(() => cleanup());

describe("contraste das telas principais (claro e escuro)", () => {
  for (const { name, path, marker } of viewScenarios) {
    it(name, async () => {
      renderA11yApp(path);
      await waitForAppReady(marker);
      expectNoContrastFailures();
    }, 40000);
  }
});

describe("contraste dos modais principais (claro e escuro)", () => {
  for (const { name, path, marker, open } of modalScenarios) {
    it(name, async () => {
      const user = userEvent.setup();
      renderA11yApp(path);
      await waitForAppReady(marker);
      await open(user);
      await screen.findByRole("dialog");
      expectNoContrastFailures();
    }, 40000);
  }
});

describe("abas internas", () => {
  for (const { name, path, marker, open } of tabScenarios) {
    it(name, async () => {
      const user = userEvent.setup();
      renderA11yApp(path);
      await waitForAppReady(marker);
      await open(user);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expectNoContrastFailures();
    }, 40000);
  }
});
