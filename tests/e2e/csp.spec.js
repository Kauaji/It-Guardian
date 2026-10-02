import { expect, test } from "@playwright/test";

// Roda contra client/dist servido com os cabecalhos de producao (scripts/serve-dist.mjs): o app inteiro precisa
// funcionar SEM nenhuma violacao da CSP e SEM requisicoes a terceiros (ADR 0007).

const views = ["/", "/avisos", "/ordens-de-servico", "/agenda", "/pecas", "/inventario"];

async function login(page) {
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("E-mail").fill("admin@itguardian.local");
  await page.getByLabel("Senha").fill("123456");
  await page.getByRole("button", { name: "Acessar painel" }).click();
  await expect(page.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeVisible({ timeout: 20_000 });
}

test("a aplicacao roda sob a CSP de producao sem violacoes nem chamadas a terceiros", async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const external = [];
  const consoleCsp = [];

  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations.push(`${event.violatedDirective} :: ${event.blockedURI}`);
    });
  });
  page.on("request", (request) => {
    const url = request.url();
    if (/^(https?|wss?):/.test(url) && !url.startsWith(origin) && !url.startsWith(origin.replace("http", "ws"))) external.push(url);
  });
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) consoleCsp.push(message.text());
  });

  const response = await page.goto("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");

  await login(page);
  const violations = [];
  for (const view of views) {
    await page.goto(view);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    violations.push(...(await page.evaluate(() => window.__cspViolations || [])));
  }

  expect(violations, "violacoes de CSP reportadas pelo navegador").toEqual([]);
  expect(consoleCsp, "mensagens de CSP no console").toEqual([]);
  expect(external, "requisicoes a origens externas").toEqual([]);
});

test("a fonte e servida pela propria origem (sem Google Fonts)", async ({ page }) => {
  const fontRequests = [];
  page.on("response", (response) => {
    if (/\.(woff2?|ttf)(\?|$)/.test(response.url())) fontRequests.push(response.url());
  });
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(fontRequests.length).toBeGreaterThan(0);
  for (const url of fontRequests) expect(new URL(url).hostname).toBe("127.0.0.1");
});
