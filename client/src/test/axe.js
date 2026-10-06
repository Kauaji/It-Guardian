import axe from "axe-core";
import { expect } from "vitest";
import { auditContrast, formatContrastFailures } from "./contrastAudit.js";

// Regras WCAG 2.0/2.1 A e AA, as mesmas do e2e (tests/e2e/a11y.spec.js, via @axe-core/playwright).
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// `color-contrast` nao funciona no jsdom (sem layout/pintura): o contraste e coberto por
// auditContrast (cascata real das folhas de estilo) e por scripts/check-contrast.mjs (tokens).
// `scrollable-region-focusable` e `target-size`-like dependem de layout.
// `placeholder` nao e rotulo: o check `non-empty-placeholder` do axe e desligado para exigir label/aria-label de verdade.
const JSDOM_UNSUPPORTED = ["color-contrast", "scrollable-region-focusable", "frame-focusable-content"];

export async function runAxe(root = document.body, { disable = [] } = {}) {
  const rules = Object.fromEntries([...JSDOM_UNSUPPORTED, ...disable].map((id) => [id, { enabled: false }]));
  const { violations } = await axe.run(root, {
    runOnly: { type: "tag", values: WCAG_TAGS },
    rules,
    checks: { "non-empty-placeholder": { enabled: false } }
  });
  return violations;
}

export function formatViolations(violations) {
  return violations.map(
    (violation) =>
      `${violation.impact} ${violation.id}: ${violation.help} (${violation.nodes.length} no(s)) ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(" | ")}`
  );
}

// Falha com a lista legivel de violacoes (todas as severidades: o objetivo e zero).
export async function expectNoAxeViolations(root = document.body, options) {
  const violations = await runAxe(root, options);
  expect(formatViolations(violations)).toEqual([]);
}

// Contraste dos textos renderizados nos dois temas, com as folhas de estilo reais.
export function expectNoContrastFailures(root = document.body, { themes = ["light", "dark"], ignore = [] } = {}) {
  const originalTheme = document.documentElement.dataset.theme;
  try {
    for (const theme of themes) {
      const { failures } = auditContrast(root, { theme });
      const relevant = failures.filter((failure) => !ignore.some((pattern) => pattern.test(failure.element)));
      expect({ theme, failures: formatContrastFailures(relevant) }).toEqual({ theme, failures: [] });
    }
  } finally {
    if (originalTheme === undefined) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = originalTheme;
  }
}
