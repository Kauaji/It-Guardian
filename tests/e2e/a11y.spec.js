import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Acessibilidade automatizada (WCAG 2.1 A/AA) nas telas principais. Falha com qualquer violacao serious/critical;
// `minor`/`moderate` aparecem no relatorio anexado mas nao quebram o build.

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const views = [
  { name: "dashboard", path: "/" },
  { name: "avisos", path: "/avisos" },
  { name: "ordens de servico", path: "/ordens-de-servico" },
  { name: "agenda", path: "/agenda" },
  { name: "pecas", path: "/pecas" },
  { name: "inventario", path: "/inventario" }
];

async function login(page) {
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("E-mail").fill("admin@itguardian.local");
  await page.getByLabel("Senha").fill("123456");
  await page.getByRole("button", { name: "Acessar painel" }).click();
  await expect(page.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeVisible({ timeout: 20_000 });
}

function summarize(violations) {
  return violations.map((violation) => `${violation.impact} ${violation.id}: ${violation.help} (${violation.nodes.length} no(s)) ${violation.nodes[0]?.target?.join(" ")}`);
}

test("tela de login nao tem violacoes serias de acessibilidade", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 15_000 });
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(summarize(violations.filter((v) => ["serious", "critical"].includes(v.impact)))).toEqual([]);
});

for (const view of views) {
  test(`tela ${view.name} nao tem violacoes serias de acessibilidade`, async ({ page }, testInfo) => {
    await login(page);
    await page.goto(view.path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
    await testInfo.attach("axe-todas-as-violacoes", { body: JSON.stringify(summarize(violations), null, 2), contentType: "application/json" });
    expect(summarize(violations.filter((v) => ["serious", "critical"].includes(v.impact)))).toEqual([]);
  });
}
