/* global window */
import { expect, test } from "@playwright/test";

const apiUrl = "http://127.0.0.1:4100";
const breadcrumbLabel = "Navegação da hierarquia do mapa de rede";
test.describe.configure({ timeout: 60_000 });
test.use({ actionTimeout: 12_000 });

async function apiJson(page, path, { method = "GET", data } = {}) {
  const response = await page.request.fetch(`${apiUrl}${path}`, {
    method,
    timeout: 10_000,
    headers: { origin: new URL(page.url()).origin },
    ...(data === undefined ? {} : { data })
  });
  expect(response.ok(), `${method} ${path}: ${response.status()}`).toBeTruthy();
  return response.json();
}

async function withTopologyFixture(page, run) {
  await page.goto("/");
  await page.getByLabel("E-mail").fill("admin@itguardian.local");
  await page.getByLabel("Senha").fill("123456");
  await page.getByRole("button", { name: "Acessar painel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeVisible();
  // Fixtures and cleanup are restricted to this suite's local in-memory API.
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:5174");
  const groups = [];
  const segments = [];
  const devices = [];
  const suffix = `${Date.now().toString(36)}-${test.info().retry}`;
  const topologyWrites = [];
  const recordWrite = (request) => {
    if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/topology")) {
      topologyWrites.push({ method: request.method(), path: new URL(request.url()).pathname });
    }
  };
  try {
    for (const letter of ["A", "B"]) {
      const { group } = await apiJson(page, "/api/segments/groups", {
        method: "POST", data: { name: `Grupo ${letter} ${suffix}`, color: "#137c6b" }
      });
      groups.push(group);
      const { segment } = await apiJson(page, "/api/segments", {
        method: "POST",
        data: { name: `Segmento ${letter} ${suffix}`, color: "#137c6b", groupId: groups[0].id }
      });
      segments.push(segment);
    }
    for (const [index, ip] of ["203.0.113.21", "203.0.113.23", "203.0.113.22"].entries()) {
      const { device } = await apiJson(page, "/api/devices/manual", {
        method: "POST",
        data: {
          name: `Servidor ${index + 1} ${suffix}`,
          type: "server",
          brand: "Laboratório E2E",
          model: "Ativo sintético",
          assetTag: `TOPO-${suffix}-${index}`,
          ip
        }
      });
      devices.push(device);
      await apiJson(page, `/api/devices/${device.id}/segment`, {
        method: "PATCH", data: { segmentId: segments[index === 2 ? 1 : 0].id }
      });
    }
    await page.reload();
    page.on("request", recordWrite);
    await run({ groups, segments, devices, topologyWrites });
  } finally {
    // Keep cleanup bounded and preserve the original UI failure if it times out.
    test.setTimeout(test.info().timeout + 15_000);
    page.off("request", recordWrite);
    const fixtureIds = new Set([...groups, ...segments, ...devices].map((item) => item.id));
    const { maps } = await apiJson(page, "/api/topology-maps");
    for (const map of maps) {
      if (fixtureIds.has(map.scopeId)) {
        await apiJson(page, `/api/topology-maps/${map.id}`, { method: "DELETE" });
      } else {
        const bundle = await apiJson(page, `/api/topology-maps/${map.id}`);
        // Leave the shared default map and all unrelated links intact.
        for (const link of bundle.links) {
          if (fixtureIds.has(link.sourceAssetId) && fixtureIds.has(link.targetAssetId)) {
            await apiJson(page, `/api/topology-map-links/${link.id}`, { method: "DELETE" });
          }
        }
      }
    }
    for (const device of devices) await apiJson(page, `/api/devices/${device.id}`, { method: "DELETE" });
    for (const segment of segments) await apiJson(page, `/api/segments/${segment.id}`, { method: "DELETE" });
    for (const group of groups) await apiJson(page, `/api/segments/groups/${group.id}`, { method: "DELETE" });
  }
}

function mapNode(page, name, kind) {
  return page.getByRole("button", { name: `${name}, ver ${kind}`, exact: true });
}

async function openMap(page) {
  await page.getByRole("button", { name: "Inventário", exact: true }).click();
  await page.getByRole("button", { name: "Mapa de Rede", exact: true }).click();
  await expect(page.getByRole("navigation", { name: breadcrumbLabel })).toBeVisible();
  await page.getByRole("heading", { name: "Infraestrutura em tempo real" }).hover();
}

async function openSegment(page, group, segment) {
  await openMap(page);
  await mapNode(page, group.name, "grupo").dblclick();
  await expect(page.getByRole("button", { name: "Editando", exact: true })).toBeVisible();
  await mapNode(page, segment.name, "segmento").dblclick();
  await expect(page.getByRole("navigation", { name: breadcrumbLabel })).toContainText(segment.name);
  await expect(page.getByRole("button", { name: "Editando", exact: true })).toBeVisible();
}

async function getScopedMap(page, scopeType, scopeId) {
  const { maps } = await apiJson(page, "/api/topology-maps");
  const map = maps.find((item) => item.scopeType === scopeType && item.scopeId === scopeId);
  expect(map).toBeTruthy();
  return apiJson(page, `/api/topology-maps/${map.id}`);
}

function waitForLinkWrite(page, method) {
  return page.waitForResponse((response) =>
    response.request().method() === method &&
    (method === "POST"
      ? /^\/api\/topology-maps\/[^/]+\/links$/.test(new URL(response.url()).pathname)
      : /^\/api\/topology-map-links\/[^/]+$/.test(new URL(response.url()).pathname)),
    { timeout: 12_000 }
  );
}

test("um clique inspeciona; dois cliques editam grupos e segmentos sem gravar posições", async ({ page }) => {
  await page.setViewportSize({ width: 883, height: 746 });
  await withTopologyFixture(page, async ({ groups, segments, devices, topologyWrites }) => {
    // Explicit fixture setup: a real, manually recorded connection inside each level.
    for (const [scopeType, scopeId, source, target, sourceType, label] of [
      ["group", groups[0].id, segments[0].id, segments[1].id, "segment", "Uplink entre segmentos"],
      ["segment", segments[0].id, devices[0].id, devices[1].id, "asset", "Backup entre servidores"]
    ]) {
      const { map } = await apiJson(page, `/api/topology-maps/by-scope?scopeType=${scopeType}&scopeId=${scopeId}`);
      await apiJson(page, `/api/topology-maps/${map.id}/links`, {
        method: "POST", data: { sourceType, targetType: sourceType, sourceAssetId: source, targetAssetId: target, label, type: "ethernet" }
      });
    }
    await openMap(page);
    await expect(page.getByRole("button", { name: /^Voltar para / })).toHaveCount(0);
    await expect(page.getByText(/Prévia do inventário|Posição não salva/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ajustar à tela", exact: true })).toHaveCount(0);
    const initialMaps = await apiJson(page, "/api/topology-maps");
    await mapNode(page, groups[0].name, "grupo").click();
    const groupInspector = page.getByRole("complementary", { name: "Detalhes do grupo", exact: true });
    await expect(groupInspector).toBeVisible();
    for (const device of devices) {
      await expect(groupInspector.getByRole("button", { name: `Abrir ficha de ${device.name}`, exact: true })).toBeVisible();
    }
    await expect(groupInspector.getByText("Uplink entre segmentos", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: breadcrumbLabel })).not.toContainText(groups[0].name);
    expect((await apiJson(page, "/api/topology-maps")).maps.map((map) => map.id).sort())
      .toEqual(initialMaps.maps.map((map) => map.id).sort());
    const drawerBox = await groupInspector.boundingBox();
    const canvasBox = await page.locator(".network-topology-canvas-wrap").boundingBox();
    expect(drawerBox.y).toBeLessThan(canvasBox.y + 24);
    expect(drawerBox.x).toBeGreaterThan(canvasBox.x);
    expect(drawerBox.x + drawerBox.width).toBeLessThanOrEqual(883);
    await groupInspector.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath("group-inspector.png") });
    await groupInspector.getByRole("button", { name: "Fechar detalhes do item" }).click();
    await mapNode(page, groups[0].name, "grupo").dblclick();
    await expect(page.getByRole("button", { name: "Editando", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: breadcrumbLabel })).toContainText(groups[0].name);
    await mapNode(page, segments[0].name, "segmento").click();
    const segmentInspector = page.getByRole("complementary", { name: "Detalhes do segmento", exact: true });
    await expect(segmentInspector.getByRole("button", { name: `Abrir ficha de ${devices[0].name}` })).toBeVisible();
    await expect(segmentInspector.getByRole("button", { name: `Abrir ficha de ${devices[1].name}` })).toBeVisible();
    await expect(segmentInspector.getByRole("button", { name: `Abrir ficha de ${devices[2].name}` })).toHaveCount(0);
    await expect(segmentInspector.getByText("Backup entre servidores", { exact: true })).toBeVisible();
    await segmentInspector.getByRole("button", { name: "Fechar detalhes do item" }).click();
    await mapNode(page, segments[0].name, "segmento").dblclick();
    await expect(page.getByRole("button", { name: "Editando", exact: true })).toBeVisible();
    await expect(mapNode(page, devices[0].name, "ativo")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Conexão entre .+: Backup entre servidores$/ })).toBeVisible();
    await expect(page.getByPlaceholder("Adicionar ativo ao mapa...")).toHaveCount(0);
    await page.getByRole("button", { name: "Voltar para " + groups[0].name, exact: true }).click();
    await expect(mapNode(page, segments[0].name, "segmento")).toBeVisible();
    await page.getByRole("button", { name: /^Voltar para / }).click();
    await expect(mapNode(page, groups[0].name, "grupo")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Voltar para / })).toHaveCount(0);
    expect(topologyWrites).toEqual([]);
  });
});

test("cria conexão e salva posições de itens automáticos, mantendo tudo ao recarregar", async ({ page }) => {
  await withTopologyFixture(page, async ({ groups, segments, devices, topologyWrites }) => {
    await openSegment(page, groups[0], segments[0]);
    await expect(page.locator(".network-topology-link")).toHaveCount(0);
    await page.getByRole("button", { name: "Criar conexão", exact: true }).click();
    await mapNode(page, devices[0].name, "ativo").click();
    await expect(page.getByRole("button", { name: "Escolha o destino", exact: true })).toBeVisible();
    await mapNode(page, devices[1].name, "ativo").hover();
    await expect(page.locator(".network-topology-link-draft")).toBeVisible();
    const created = waitForLinkWrite(page, "POST");
    await mapNode(page, devices[1].name, "ativo").click();
    expect((await created).status()).toBe(201);
    const inspector = page.getByRole("complementary", { name: "Detalhes da conexão", exact: true });
    await expect(inspector).toBeVisible();
    await inspector.getByLabel("Rótulo", { exact: true }).fill("Backup principal");
    await inspector.getByRole("combobox", { name: "Tipo", exact: true }).selectOption("fiber");
    const saved = waitForLinkWrite(page, "PATCH");
    await inspector.getByRole("button", { name: "Salvar conexão", exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
    let bundle = await getScopedMap(page, "segment", segments[0].id);
    expect(bundle.nodes).toEqual([]);
    expect(bundle.links).toHaveLength(1);
    expect(bundle.links[0]).toMatchObject({ sourceType: "asset", targetType: "asset", label: "Backup principal", type: "fiber" });
    expect(new Set([bundle.links[0].sourceAssetId, bundle.links[0].targetAssetId])).toEqual(new Set(devices.slice(0, 2).map((device) => device.id)));
    await page.reload();
    await openSegment(page, groups[0], segments[0]);
    const line = page.getByRole("button", { name: /^Conexão entre .+: Backup principal$/ });
    await expect(line).toBeVisible();
    await line.click();
    await expect(page.getByRole("complementary", { name: "Detalhes da conexão" }).getByLabel("Rótulo", { exact: true })).toHaveValue("Backup principal");
    bundle = await getScopedMap(page, "segment", segments[0].id);
    expect(bundle.links).toHaveLength(1);
    expect(bundle.nodes).toEqual([]);
    expect(topologyWrites.filter((entry) => entry.method === "POST")).toHaveLength(1);
    expect(topologyWrites.some((entry) => /nodes|positions/.test(entry.path))).toBe(false);
    await page.getByRole("button", { name: "Fechar detalhes da conexão" }).click();
    const firstNode = mapNode(page, devices[0].name, "ativo");
    await firstNode.click();
    await expect(page.getByRole("complementary", { name: "Detalhes do ativo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar ao mapa", exact: true })).toHaveCount(0);
    await expect(page.getByText("Conexões informadas manualmente; não são detectadas automaticamente.")).toHaveCount(0);
    await page.getByRole("button", { name: "Fechar detalhes do ativo", exact: true }).click();
    await firstNode.scrollIntoViewIfNeeded();
    const initialTransform = await firstNode.evaluate((element) => element.closest("g").getAttribute("transform"));
    const nodeBox = await firstNode.boundingBox();
    await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(nodeBox.x + nodeBox.width / 2 + 75, nodeBox.y + nodeBox.height / 2 + 45, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => firstNode.evaluate((element) => element.closest("g").getAttribute("transform"))).not.toBe(initialTransform);
    const positionSaved = page.waitForResponse((response) =>
      response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith("/nodes/positions")
    );
    await page.getByRole("button", { name: "Salvar layout", exact: true }).click();
    expect((await positionSaved).ok()).toBeTruthy();
    await expect(page.getByRole("button", { name: "Salvar layout", exact: true })).toBeDisabled();
    await expect(mapNode(page, devices[1].name, "ativo")).toBeVisible();
    await expect(line).toBeVisible();
    bundle = await getScopedMap(page, "segment", segments[0].id);
    expect(bundle.nodes).toHaveLength(1);
    expect(bundle.nodes[0].assetId).toBe(devices[0].id);
    expect(bundle.links).toHaveLength(1);
    const storedPosition = bundle.nodes[0];
    await apiJson(page, `/api/devices/${devices[2].id}/segment`, {
      method: "PATCH", data: { segmentId: segments[0].id }
    });
    await page.reload();
    await openSegment(page, groups[0], segments[0]);
    await expect(mapNode(page, devices[1].name, "ativo")).toBeVisible();
    await expect(mapNode(page, devices[2].name, "ativo")).toBeVisible();
    await expect(line).toBeVisible();
    bundle = await getScopedMap(page, "segment", segments[0].id);
    expect(bundle.nodes).toEqual([storedPosition]);
    expect(topologyWrites.filter((entry) => entry.method === "POST" && entry.path.endsWith("/nodes"))).toHaveLength(1);
    expect(topologyWrites.filter((entry) => entry.path.endsWith("/nodes/positions"))).toHaveLength(1);
    await line.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath("persisted-connection.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator(".network-topology-toolbar").evaluate((element) =>
      element.scrollWidth <= element.clientWidth + 1
    )).toBe(true);
    await page.screenshot({ path: test.info().outputPath("mobile-toolbar.png") });
  });
});

test("grupos têm conexões editáveis e zoom suave sem rolar a página", async ({ page }) => {
  await withTopologyFixture(page, async ({ groups }) => {
    await openMap(page);
    await page.getByRole("button", { name: "Visualizando", exact: true }).click();
    await page.getByRole("button", { name: "Criar conexão", exact: true }).click();
    await mapNode(page, groups[0].name, "grupo").click();
    const created = waitForLinkWrite(page, "POST");
    await mapNode(page, groups[1].name, "grupo").click();
    expect((await created).status()).toBe(201);
    const inspector = page.getByRole("complementary", { name: "Detalhes da conexão", exact: true });
    await inspector.getByLabel("Rótulo", { exact: true }).fill("Uplink de ambientes");
    const saved = waitForLinkWrite(page, "PATCH");
    await inspector.getByRole("button", { name: "Salvar conexão", exact: true }).click();
    const { link } = await (await saved).json();
    expect(link).toMatchObject({ sourceType: "group", targetType: "group", label: "Uplink de ambientes" });
    await inspector.getByRole("button", { name: "Fechar detalhes da conexão" }).click();
    await expect(page.getByRole("button", { name: /^Conexão entre .+: Uplink de ambientes$/ })).toBeVisible();
    const canvas = page.locator(".network-topology-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const before = (await canvas.getAttribute("viewBox")).split(" ").map(Number);
    const box = await canvas.boundingBox();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.move(box.x + 35, Math.max(10, box.y + 35));
    await page.mouse.wheel(0, 120);
    await expect.poll(async () => Number((await canvas.getAttribute("viewBox")).split(" ")[2])).toBeGreaterThan(before[2]);
    const after = (await canvas.getAttribute("viewBox")).split(" ").map(Number);
    expect(after[2] / before[2]).toBeGreaterThan(1.02);
    expect(after[2] / before[2]).toBeLessThan(1.08);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });
});
