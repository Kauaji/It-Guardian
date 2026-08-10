import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const OUTPUT_DIR = "output/playwright";

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

function buildFloorPlanFixture() {
  const unique = Date.now().toString(36);
  const floorId = `floor-e2e-${unique}`;
  const roomId = `room-e2e-${unique}`;
  const deskId = `desk-e2e-${unique}`;

  return {
    plan: {
      name: `Laboratorio E2E ${unique}`,
      company: "IT Guardian",
      unit: "Validacao automatizada",
      floorLabel: "Terreo",
      status: "draft",
      width: 1280,
      height: 820,
      gridSize: 20,
      snapSize: 10,
      activeFloorId: floorId
    },
    floors: [{ id: floorId, name: "Terreo", level: 1, width: 1280, height: 820 }],
    zones: [{
      id: roomId,
      floorId,
      zoneType: "room",
      name: "Sala de operacoes",
      color: "#dbeafe",
      geometry: { x: 180, y: 140, width: 720, height: 480 }
    }],
    objects: [
      {
        id: deskId,
        floorId,
        objectType: "desk",
        category: "furniture",
        label: "Mesa tecnica",
        x: 330,
        y: 290,
        width: 180,
        height: 90,
        height3d: 46,
        color: "#a16207",
        metadata: { parentRoomId: roomId }
      },
      {
        id: `pc-e2e-${unique}`,
        floorId,
        objectType: "pc",
        category: "it",
        label: "Estacao E2E",
        x: 375,
        y: 305,
        width: 70,
        height: 48,
        height3d: 56,
        color: "#2563eb",
        metadata: { parentRoomId: roomId, anchorObjectId: deskId }
      },
      {
        id: `chair-e2e-${unique}`,
        floorId,
        objectType: "office_chair",
        category: "furniture",
        label: "Cadeira ergonomica",
        x: 380,
        y: 405,
        width: 66,
        height: 66,
        height3d: 92,
        color: "#334155",
        metadata: { parentRoomId: roomId }
      },
      {
        id: `tv-e2e-${unique}`,
        floorId,
        objectType: "tv",
        category: "it",
        label: "Painel de operacoes",
        x: 690,
        y: 180,
        width: 130,
        height: 28,
        height3d: 58,
        color: "#0f172a",
        metadata: { parentRoomId: roomId }
      }
    ],
    connectionPoints: [],
    cableRoutes: []
  };
}

async function captureStableCanvas(page) {
  let lastError;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const canvas = page.locator(".floor-plan-scene-3d canvas").last();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);

    try {
      return await canvas.screenshot({ animations: "disabled" });
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(500);
    }
  }

  throw lastError;
}

async function assertCanvasHasRenderedPixels(page) {
  const png = await captureStableCanvas(page);
  const stats = await page.evaluate(async (base64Png) => {
    const image = new globalThis.Image();
    image.src = `data:image/png;base64,${base64Png}`;
    await image.decode();

    const sample = globalThis.document.createElement("canvas");
    sample.width = image.naturalWidth;
    sample.height = image.naturalHeight;
    const context = sample.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const colorBuckets = new Set();
    let visiblePixels = 0;
    let contrastedPixels = 0;

    for (let index = 0; index < pixels.length; index += 64) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      if (alpha > 0) visiblePixels += 1;
      if (Math.min(red, green, blue) < 230 || Math.max(red, green, blue) - Math.min(red, green, blue) > 10) {
        contrastedPixels += 1;
      }
      colorBuckets.add(`${red >> 4}:${green >> 4}:${blue >> 4}:${alpha >> 4}`);
    }

    return {
      width: sample.width,
      height: sample.height,
      visiblePixels,
      contrastedPixels,
      colorBuckets: colorBuckets.size
    };
  }, png.toString("base64"));

  expect(stats.width).toBeGreaterThan(100);
  expect(stats.height).toBeGreaterThan(100);
  expect(stats.visiblePixels).toBeGreaterThan(100);
  expect(stats.contrastedPixels).toBeGreaterThan(100);
  expect(stats.colorBuckets).toBeGreaterThan(5);
}

test("editor de plantas renderiza 2D e 3D em desktop e mobile", async ({ page, context }) => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await login(page);

  const createResponse = await context.request.post("http://127.0.0.1:4100/api/floor-plans", {
    headers: { Origin: "http://127.0.0.1:5174" },
    data: buildFloorPlanFixture()
  });
  const createBody = await createResponse.text();
  expect(createResponse.ok(), createBody).toBeTruthy();

  const created = JSON.parse(createBody);
  const planId = created?.plan?.plan?.id;
  expect(planId).toBeTruthy();

  try {
    await page.goto(`/plantas/${planId}/editor`);
    await expect(page.getByText("Sala de operacoes", { exact: true })).toBeVisible({ timeout: 15_000 });

    const editor2d = page.locator("svg.floor-plan-canvas");
    await expect(editor2d).toBeVisible();
    await expect(page.getByText("Estacao E2E", { exact: true })).toBeVisible();
    await editor2d.screenshot({ path: `${OUTPUT_DIR}/floor-plan-desktop-2d.png` });

    await page.getByRole("button", { name: "3D", exact: true }).click();
    const canvas3d = page.locator(".floor-plan-scene-3d canvas");
    await expect(canvas3d).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
    await assertCanvasHasRenderedPixels(page);
    await page.locator(".floor-plan-stage").screenshot({ path: `${OUTPUT_DIR}/floor-plan-desktop-3d.png` });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".floor-plan-editor-topbar")).toBeVisible();
    await expect(canvas3d).toBeVisible();
    await assertCanvasHasRenderedPixels(page);
    await page.screenshot({ path: `${OUTPUT_DIR}/floor-plan-mobile-3d.png`, fullPage: true });

    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect(editor2d).toBeVisible();
    await page.screenshot({ path: `${OUTPUT_DIR}/floor-plan-mobile-2d.png`, fullPage: true });
  } finally {
    await context.request.delete(`http://127.0.0.1:4100/api/floor-plans/${planId}`, {
      headers: { Origin: "http://127.0.0.1:5174" }
    });
  }
});
