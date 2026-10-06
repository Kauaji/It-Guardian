import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import * as api from "../api.js";
import { renderA11yApp, setupA11yApiMocks, waitForAppReady } from "../test/a11yApp.jsx";
import { modalScenarios, tabScenarios, viewScenarios } from "../test/a11yScenarios.js";
import { expectNoAxeViolations } from "../test/axe.js";

vi.mock("../api.js");

// Axe (WCAG 2.1 A/AA) sobre as visoes REAIS montadas com dados mockados. Espelha
// tests/e2e/a11y.spec.js (navegador). `color-contrast` nao roda no jsdom: ver contrast.a11y.test.jsx.
beforeEach(() => setupA11yApiMocks(api));
afterEach(() => cleanup());

describe("telas principais", () => {
  for (const { name, path, marker } of viewScenarios) {
    it(`${name}: sem violações axe (WCAG 2.1 A/AA)`, async () => {
      renderA11yApp(path);
      await waitForAppReady(marker);
      await expectNoAxeViolations();
    }, 40000);
  }
});

describe("modais principais", () => {
  for (const { name, path, marker, open } of modalScenarios) {
    it(`${name}: sem violações axe`, async () => {
      const user = userEvent.setup();
      renderA11yApp(path);
      await waitForAppReady(marker);
      await open(user);
      await screen.findByRole("dialog");
      await expectNoAxeViolations();
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
      await expectNoAxeViolations();
    }, 40000);
  }
});
