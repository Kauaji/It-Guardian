import { expect, test } from "@playwright/test";

async function login(page) {
  await page.goto("/");
  await page.getByLabel("E-mail").fill("admin@itguardian.local");
  await page.getByLabel("Senha").fill("123456");
  await page.getByRole("button", { name: "Acessar painel" }).click();
  await expect(page.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeVisible();
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
    database: "connected"
  });
});
