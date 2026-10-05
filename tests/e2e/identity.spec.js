import { expect, test } from "@playwright/test";

// Admin demo (seed de demonstracao): senha publica e SEM troca obrigatoria, sem MFA.
const demoEmail = "admin@itguardian.local";
const demoPassword = "123456";

async function login(page) {
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 12_000 });
  await page.getByLabel("E-mail").fill(demoEmail);
  await page.getByLabel("Senha").fill(demoPassword);
  await page.getByRole("button", { name: "Acessar painel" }).click();
  await expect(page.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeVisible({ timeout: 12_000 });
}

test("login com o admin demo entra direto (sem MFA nem troca obrigatoria)", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Troque a senha para continuar" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Verificação em duas etapas" })).toHaveCount(0);
});

test("senha errada mostra mensagem generica e nao entra", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("E-mail").fill(demoEmail);
  await page.getByLabel("Senha").fill("senha-errada-123");
  await page.getByRole("button", { name: "Acessar painel" }).click();
  await expect(page.getByRole("alert")).toContainText("E-mail ou senha inválidos.");
  await expect(page.getByRole("heading", { name: "Infraestrutura em tempo real" })).toHaveCount(0);
});

test("menu da conta abre a pagina Seguranca da conta com senha, MFA e sessoes", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Minha conta" }).click();
  await page.getByRole("menuitem", { name: /Segurança da conta/ }).click();

  await expect(page).toHaveURL(/\/conta\/seguranca$/);
  await expect(page.getByRole("heading", { name: "Segurança da conta" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Senha", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Verificação em duas etapas/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sessões ativas" })).toBeVisible();

  // A sessao atual aparece marcada.
  await expect(page.getByText("Esta sessão")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ativar verificação em duas etapas" })).toBeVisible();
});

test("a pagina de seguranca abre direto pela URL apos recarregar", async ({ page }) => {
  await login(page);
  await page.goto("/conta/seguranca");
  await expect(page.getByRole("heading", { name: "Segurança da conta" })).toBeVisible();
});
