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

test("login usa cookie HttpOnly e restaura a sessao apos recarregar", async ({ page, context }) => {
  await login(page);

  const storage = await page.evaluate(() => ({
    sessionToken: sessionStorage.getItem("it_guardian_token"),
    localToken: localStorage.getItem("it_guardian_token")
  }));
  expect(storage.sessionToken).toBeNull();
  expect(storage.localToken).toBeNull();

  const cookies = await context.cookies();
  expect(cookies).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: "it_guardian_session",
      httpOnly: true,
      sameSite: "Lax"
    })
  ]));

  await page.reload();
  await expect(page.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeVisible();
});

test("navega para Ordens de Servico e fecha detalhes com Escape", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: /Ordens de Servi/ }).click();
  await expect(page.getByRole("heading", { name: /Ordens de Servi/ })).toBeVisible();

  const firstOrder = page.locator(".service-order-card").first();
  await expect(firstOrder).toBeVisible();
  await firstOrder.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("API health confirma o banco", async ({ request }) => {
  const response = await request.get("http://127.0.0.1:4100/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    database: "ok"
  });
});
