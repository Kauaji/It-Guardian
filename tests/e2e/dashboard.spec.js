import { expect, test } from "@playwright/test";

const apiUrl = "http://127.0.0.1:4100";
const availabilityLabel = "Disponibilidade de Ativos";
const overviewLabel = "Status Geral da Infraestrutura";

test.describe.configure({ timeout: 60_000 });

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

function widgetCards(page, label) {
  return page.locator(".dashboard-widget-card").filter({
    has: page.getByRole("heading", { name: label, exact: true })
  });
}

function catalogCard(page, catalog, label) {
  return catalog.locator(".dashboard-widget-catalog-card").filter({
    has: page.getByRole("button", { name: `Adicionar ${label}`, exact: true })
  });
}

async function apiJson(page, path, { method = "GET", data } = {}) {
  const response = await page.request.fetch(`${apiUrl}${path}`, {
    method,
    headers: { origin: new URL(page.url()).origin },
    ...(data === undefined ? {} : { data })
  });
  expect(response.ok(), `${method} ${path} retornou ${response.status()}`).toBeTruthy();
  return response.json();
}

function isLayoutResponse(response, method) {
  return response.request().method() === method && new URL(response.url()).pathname === "/api/dashboard/layout";
}

function isPreviewResponse(response, type, assetStatus) {
  if (
    response.request().method() !== "POST" ||
    new URL(response.url()).pathname !== "/api/dashboard/widgets/preview"
  ) return false;
  const payload = response.request().postDataJSON();
  return payload.type === type && (
    assetStatus
      ? payload.filters?.assetStatus === assetStatus
      : !Object.keys(payload.filters || {}).length
  );
}

async function withDashboardFixture(page, run) {
  await login(page);
  // These fixtures belong only to the local, in-memory Playwright server.
  // The demo seed has OS/groups, but no longer guarantees monitored assets.
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:5174");
  const originalLayout = await apiJson(page, "/api/dashboard/layout");
  const createdIds = [];

  try {
    const defaultLayout = await apiJson(page, "/api/dashboard/layout/reset", { method: "POST" });
    const unique = `${Date.now().toString(36)}-${test.info().retry}`;
    // PingService's local mock is deterministic: .23 is offline, .21 is online.
    for (const [status, ip] of [["offline", "203.0.113.23"], ["online", "203.0.113.21"]]) {
      const { device } = await apiJson(page, "/api/devices/manual", {
        method: "POST",
        data: {
          name: `Dashboard E2E ${status} ${unique}`,
          type: "desktop",
          brand: "Laboratório E2E",
          model: "Ativo sintético",
          assetTag: `DASH-${status}-${unique}`,
          ip
        }
      });
      createdIds.push(device.id);
      expect(device.status).toBe(status);
    }

    await page.reload();
    await expect(widgetCards(page, overviewLabel)).toBeVisible();
    await expect(page.locator(".dashboard-widget-loading")).toHaveCount(0);
    await run({ defaultLayout });
  } finally {
    // Restore preferences even on assertion failures; never delete seed assets.
    await apiJson(page, "/api/dashboard/layout", { method: "PUT", data: originalLayout });
    for (const id of createdIds) {
      await apiJson(page, `/api/devices/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
  }
}

async function openCatalog(page) {
  await page.getByRole("button", { name: "Editar dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar widget", exact: true }).click();
  const catalog = page.getByRole("dialog", { name: "Adicionar widget", exact: true });
  await expect(catalog).toBeVisible();
  await expect(catalog.getByRole("combobox", { name: `Visualização de ${availabilityLabel}`, exact: true })).toBeVisible();
  return catalog;
}

test("dashboard mostra os widgets atuais, indicadores e gráficos sem erros de execução", async ({ page }) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await withDashboardFixture(page, async ({ defaultLayout }) => {
    const overview = widgetCards(page, overviewLabel);
    await expect(overview.getByText("Ativos", { exact: true })).toBeVisible();
    await expect(overview.getByText("OS abertas", { exact: true })).toBeVisible();
    await expect(overview.getByText("OS vencidas", { exact: true })).toBeVisible();
    await expect(page.locator(".dashboard-widget-grid")).toBeVisible();
    await expect(page.locator(".dashboard-widget-card")).toHaveCount(defaultLayout.widgets.length);
    await expect(widgetCards(page, availabilityLabel).getByRole("button", { name: /^Filtrar por Offline: \d+$/ })).toBeVisible();
    await expect(widgetCards(page, "OS por Status")).toBeVisible();
    await expect(page.getByRole("region", { name: "Filtros do dashboard" })).toBeVisible();
    await expect(page.locator(".dashboard-widget-error")).toHaveCount(0);
  });

  const meaningfulErrors = consoleErrors.filter(
    (text) =>
      !text.includes("WebSocket") &&
      !text.includes("401 (Unauthorized)")
  );
  expect(meaningfulErrors).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test("catálogo mostra prévias de pizza, colunas, barras, rosca e linha antes de adicionar", async ({ page }) => {
  await withDashboardFixture(page, async ({ defaultLayout }) => {
    const catalog = await openCatalog(page);
    const card = catalogCard(page, catalog, availabilityLabel);
    const visualization = card.getByRole("combobox", { name: `Visualização de ${availabilityLabel}`, exact: true });

    for (const [value, label] of [["pie", "Pizza"], ["columns", "Colunas"], ["bars", "Barras"], ["donut", "Rosca"]]) {
      await visualization.selectOption(value);
      await expect(visualization).toHaveValue(value);
      await expect(card.getByRole("img", { name: `Prévia ilustrativa: ${label}`, exact: true })).toBeVisible();
      await expect(card.getByText("Prévia ilustrativa", { exact: true })).toBeVisible();
    }

    const historyCard = catalogCard(page, catalog, "Grafico Historico de CPU");
    await historyCard.getByRole("combobox", { name: "Visualização de Grafico Historico de CPU", exact: true }).selectOption("line");
    await expect(historyCard.getByRole("img", { name: "Prévia ilustrativa: Linha", exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(catalog).toBeHidden();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    expect(await apiJson(page, "/api/dashboard/layout")).toEqual(defaultLayout);
  });
});

test("escolher pizza no catálogo, adicionar e salvar preserva chartType após recarregar", async ({ page }) => {
  await withDashboardFixture(page, async ({ defaultLayout }) => {
    const existingIds = new Set(defaultLayout.widgets.map((widget) => widget.id));
    const initialAvailabilityCount = defaultLayout.widgets.filter((widget) => widget.type === "asset_availability").length;
    const catalog = await openCatalog(page);
    const card = catalogCard(page, catalog, availabilityLabel);
    await card.getByRole("combobox", { name: `Visualização de ${availabilityLabel}`, exact: true }).selectOption("pie");
    await expect(card.getByRole("img", { name: "Prévia ilustrativa: Pizza", exact: true })).toBeVisible();
    await card.getByRole("button", { name: `Adicionar ${availabilityLabel}`, exact: true }).click();
    await expect(catalog).toBeHidden();
    await expect(widgetCards(page, availabilityLabel)).toHaveCount(initialAvailabilityCount + 1);

    const savedResponse = page.waitForResponse((response) => isLayoutResponse(response, "PUT"));
    await page.getByRole("button", { name: "Salvar layout", exact: true }).click();
    const saved = await savedResponse;
    expect(saved.ok()).toBeTruthy();
    const savedLayout = await saved.json();
    const addedWidget = savedLayout.widgets.find((widget) => !existingIds.has(widget.id));
    expect(addedWidget).toMatchObject({ type: "asset_availability", config: { chartType: "pie" } });
    expect(saved.request().postDataJSON().widgets.find((widget) => widget.id === addedWidget.id).config.chartType).toBe("pie");
    await expect(page.getByRole("button", { name: "Editar dashboard", exact: true })).toBeVisible();

    const reloadedResponse = page.waitForResponse((response) => isLayoutResponse(response, "GET"));
    await page.reload();
    const reloaded = await reloadedResponse;
    expect(reloaded.ok()).toBeTruthy();
    const reloadedLayout = await reloaded.json();
    expect(reloadedLayout.widgets.find((widget) => widget.id === addedWidget.id)).toMatchObject({
      type: "asset_availability", config: { chartType: "pie" }
    });
    await expect(widgetCards(page, availabilityLabel)).toHaveCount(initialAvailabilityCount + 1);
    await expect(widgetCards(page, availabilityLabel).last().locator(".recharts-pie").first()).toBeVisible();
  });
});

test("clicar em Offline filtra outros widgets e limpar restaura os dados completos", async ({ page }) => {
  await withDashboardFixture(page, async () => {
    const baseline = await apiJson(page, "/api/dashboard/widgets/preview", {
      method: "POST", data: { type: "asset_availability", config: {} }
    });
    const offlineCount = baseline.data.byStatus.offline;
    expect(offlineCount).toBeGreaterThan(0);
    expect(baseline.data.total).toBeGreaterThan(offlineCount);

    const availability = widgetCards(page, availabilityLabel);
    const overview = widgetCards(page, overviewLabel);
    await expect(overview.locator(".dashboard-widget-stat").filter({ has: page.getByText("Ativos", { exact: true }) }).locator("dd")).toHaveText(String(baseline.data.total));
    const filteredAvailability = page.waitForResponse((response) => isPreviewResponse(response, "asset_availability", "offline"));
    const filteredOverview = page.waitForResponse((response) => isPreviewResponse(response, "status_overview", "offline"));
    await availability.getByRole("button", { name: `Filtrar por Offline: ${offlineCount}`, exact: true }).click();

    const chip = page.getByRole("button", { name: "Remover filtro Status: Offline", exact: true });
    await expect(chip).toBeVisible();
    for (const response of await Promise.all([filteredAvailability, filteredOverview])) {
      expect(response.ok()).toBeTruthy();
      const payload = await response.json();
      if (payload.type === "asset_availability") {
        expect(payload.data).toMatchObject({ total: offlineCount, byStatus: { online: 0, offline: offlineCount } });
      } else {
        expect(payload.data).toMatchObject({ totalAssets: offlineCount, onlineAssets: 0, offlineAssets: offlineCount });
      }
    }
    await expect(overview.locator(".dashboard-widget-stat").filter({ has: page.getByText("Ativos", { exact: true }) }).locator("dd")).toHaveText(String(offlineCount));
    await expect(overview.getByRole("button", { name: "Filtrar por Online: 0", exact: true })).toBeVisible();
    await expect(availability.getByRole("button", { name: "Filtrar por Online: 0", exact: true })).toBeVisible();

    const restoredAvailability = page.waitForResponse((response) => isPreviewResponse(response, "asset_availability"));
    const restoredOverview = page.waitForResponse((response) => isPreviewResponse(response, "status_overview"));
    await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await expect(chip).toBeHidden();
    const availabilityResponse = await restoredAvailability;
    const overviewResponse = await restoredOverview;
    expect(availabilityResponse.ok()).toBeTruthy();
    expect(overviewResponse.ok()).toBeTruthy();
    const restoredAssets = (await availabilityResponse.json()).data;
    const restoredStatus = (await overviewResponse.json()).data;
    // Other specs may enroll an agent concurrently; compare the UI with the
    // fresh, unfiltered response rather than hardcoding the demo fleet size.
    expect(restoredAssets.total).toBeGreaterThan(offlineCount);
    expect(restoredAssets.byStatus.online).toBeGreaterThan(0);
    expect(restoredStatus.totalAssets).toBe(restoredAssets.total);
    await expect(overview.locator(".dashboard-widget-stat").filter({ has: page.getByText("Ativos", { exact: true }) }).locator("dd")).toHaveText(String(restoredAssets.total));
    await expect(availability.getByRole("button", {
      name: `Filtrar por Online: ${restoredAssets.byStatus.online}`, exact: true
    })).toBeVisible();
    await expect(page.locator(".dashboard-widget-error")).toHaveCount(0);
  });
});

test("resumo cabe no próprio card em desktop compacto e celular", async ({ page }) => {
  await withDashboardFixture(page, async () => {
    for (const viewport of [{ width: 903, height: 574 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const overview = widgetCards(page, overviewLabel);
      await expect(overview).toBeVisible();
      await expect(overview.getByText("Alertas críticos", { exact: true })).toBeVisible();
      await expect.poll(() => overview.locator(".dashboard-widget-card-body").evaluate((body) => body.scrollHeight - body.clientHeight)).toBeLessThanOrEqual(1);
      await expect.poll(() => overview.evaluate((card) => card.scrollWidth - card.clientWidth)).toBeLessThanOrEqual(1);
      await expect.poll(() => page.locator("html").evaluate((root) => root.scrollWidth - root.clientWidth)).toBeLessThanOrEqual(1);
    }
  });
});
