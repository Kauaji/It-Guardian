import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Acessibilidade automatizada (WCAG 2.1 A/AA) nas telas principais, em modais e na pagina da conta. Falha com
// qualquer violação serious/critical; `minor`/`moderate` aparecem no relatório anexado mas não quebram o build.
// Complementos que rodam sem navegador: client/src/a11y/*.test.jsx (axe no jsdom, teclado/foco, contraste
// calculado com as folhas de estilo reais) e `npm run check:contrast` (pares de tokens nos dois temas).

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const views = [
  { name: "dashboard", path: "/" },
  { name: "avisos", path: "/avisos" },
  { name: "ordens de serviço", path: "/ordens-de-servico" },
  { name: "agenda", path: "/agenda" },
  { name: "peças", path: "/pecas" },
  { name: "inventário", path: "/inventario" }
];

async function login(page) {
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("E-mail").fill("admin@itguardian.local");
  await page.getByLabel("Senha").fill("123456");
  await page.getByRole("button", { name: "Acessar painel" }).click();
  await expect(page.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeVisible({ timeout: 20_000 });
}

function seriousOrWorse(violations) {
  return violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
}

function summarize(violations) {
  return violations.map((violation) => `${violation.impact} ${violation.id}: ${violation.help} (${violation.nodes.length} nó(s)) ${violation.nodes[0]?.target?.join(" ")}`);
}

test("tela de login não tem violações sérias de acessibilidade", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 15_000 });
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(summarize(violations.filter((v) => ["serious", "critical"].includes(v.impact)))).toEqual([]);
});

for (const view of views) {
  test(`tela ${view.name} não tem violações sérias de acessibilidade`, async ({ page }, testInfo) => {
    await login(page);
    await page.goto(view.path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
    await testInfo.attach("axe-todas-as-violacoes", { body: JSON.stringify(summarize(violations), null, 2), contentType: "application/json" });
    expect(summarize(violations.filter((v) => ["serious", "critical"].includes(v.impact)))).toEqual([]);
  });
}

test("detalhe da OS aberto não tem violações sérias de acessibilidade", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/ordens-de-servico");
  await page.waitForLoadState("networkidle");
  const firstOrder = page.locator(".service-order-card").first();
  await expect(firstOrder).toBeVisible();
  await firstOrder.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  await testInfo.attach("axe-detalhe-da-os", { body: JSON.stringify(summarize(violations), null, 2), contentType: "application/json" });
  expect(summarize(seriousOrWorse(violations))).toEqual([]);
  // Escape fecha o diálogo e devolve o foco ao cartão que o abriu.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(firstOrder).toBeFocused();
});

test("modal de configurações gerais não tem violações sérias de acessibilidade", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /Configurações/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(summarize(seriousOrWorse(violations))).toEqual([]);
});

test("página /conta/seguranca não tem violações sérias de acessibilidade", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/conta/seguranca");
  await expect(page.getByRole("heading", { name: "Segurança da conta" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  await testInfo.attach("axe-conta-seguranca", { body: JSON.stringify(summarize(violations), null, 2), contentType: "application/json" });
  expect(summarize(seriousOrWorse(violations))).toEqual([]);
});

test("o primeiro Tab leva ao link 'Pular para o conteúdo', que foca o <main>", async ({ page }) => {
  await login(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#conteudo-principal")).toBeFocused();
});
