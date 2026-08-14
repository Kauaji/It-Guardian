import { expect, test } from "@playwright/test";

async function login(page) {
  await page.goto("/");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dashboardHeading = page.getByRole("heading", { name: "Infraestrutura em tempo real" });
    if (await dashboardHeading.isVisible().catch(() => false)) return;

    await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 12_000 });
    await page.getByLabel("E-mail").fill("admin@itguardian.local");
    await page.getByLabel("Senha").fill("123456");
    await page.getByRole("button", { name: "Acessar painel" }).click();

    try {
      await expect(dashboardHeading).toBeVisible({ timeout: 12_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(750);
      await page.reload();
    }
  }
}

test("dashboard mostra indicadores, saude da infraestrutura e graficos sem erros no console", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await login(page);

  await expect(page.locator(".dashboard-health-card")).toBeVisible();
  await expect(page.getByText("Saude da infraestrutura")).toBeVisible();
  await expect(page.getByText("OS abertas", { exact: true })).toBeVisible();
  await expect(page.getByText("OS vencidas", { exact: true })).toBeVisible();

  const chartGrid = page.locator(".dashboard-chart-grid");
  await expect(chartGrid).toBeVisible();
  await expect(chartGrid.locator(".dashboard-chart-card").first()).toBeVisible();

  const rankingGrid = page.locator(".dashboard-ranking-grid");
  await expect(rankingGrid).toBeVisible();

  const meaningfulErrors = consoleErrors.filter(
    (text) =>
      !text.includes("ERR_CONNECTION") &&
      !text.includes("WebSocket") &&
      !text.includes("401 (Unauthorized)")
  );
  expect(meaningfulErrors).toEqual([]);
});

test("filtro de periodo do dashboard atualiza o resumo sem quebrar a pagina", async ({ page }) => {
  await login(page);

  const periodSelect = page.locator(".dashboard-period-filter select");
  await expect(periodSelect).toBeVisible();

  const summaryRequest = page.waitForResponse(
    (response) => response.url().includes("/api/dashboard/summary") && response.url().includes("period=7d")
  );
  await periodSelect.selectOption("7d");
  const response = await summaryRequest;
  expect(response.ok()).toBeTruthy();

  await expect(page.locator(".dashboard-health-card")).toBeVisible();
});

test("ranking de OS abertas mais antigas navega para Ordens de Servico ao clicar", async ({ page }) => {
  await login(page);

  const oldestOpenCard = page.locator(".dashboard-ranking-card", { hasText: "OS abertas mais antigas" });
  await expect(oldestOpenCard).toBeVisible();

  const firstItem = oldestOpenCard.locator("button.dashboard-ranking-item.clickable").first();
  if (await firstItem.isVisible().catch(() => false)) {
    await firstItem.click();
    await expect(page.getByRole("heading", { name: /Ordens de Servi/ })).toBeVisible();
  }
});
