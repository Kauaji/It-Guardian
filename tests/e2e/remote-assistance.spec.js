import { expect, test } from "@playwright/test";

const apiUrl = "http://127.0.0.1:4100";

async function login(page) {
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toBeVisible({ timeout: 12_000 });
  await page.getByLabel("E-mail").fill("admin@itguardian.local");
  await page.getByLabel("Senha").fill("123456");
  await page.getByRole("button", { name: "Acessar painel" }).click();
  await expect(page.getByRole("heading", { name: "Infraestrutura em tempo real" })).toBeVisible();
}

async function connectLabAgent(page) {
  return page.evaluate(async ({ baseUrl }) => {
    const enrollmentResponse = await fetch(`${baseUrl}/api/agents/enrollments`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Agente do E2E remoto" })
    });
    if (!enrollmentResponse.ok) throw new Error(await enrollmentResponse.text());
    const enrollment = await enrollmentResponse.json();

    const heartbeatResponse = await fetch(`${baseUrl}/api/agents/heartbeat`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${enrollment.token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        machineId: "remote-assistance-e2e-machine",
        hostname: "LAB-REMOTE-E2E",
        machineAlias: "Notebook remoto E2E",
        operatingSystem: "Microsoft Windows 11 Pro",
        osArchitecture: "64-bit",
        windowsVersion: "23H2",
        localIp: "192.168.50.80",
        macAddress: "00-11-22-33-44-80",
        cpuModel: "Intel Core i7",
        memoryTotalBytes: 17179869184,
        diskTotalBytes: 512000000000,
        diskFreeBytes: 256000000000,
        uptimeSeconds: 7200,
        agentVersion: "1.0.0-e2e",
        collectedAt: new Date().toISOString(),
        intervalSeconds: 60,
        environment: "Laboratorio E2E",
        group: "Suporte",
        segment: "Windows",
        inventoryDetails: { cpuCores: 8, software: [] }
      })
    });
    if (!heartbeatResponse.ok) throw new Error(await heartbeatResponse.text());
    const heartbeat = await heartbeatResponse.json();
    return { heartbeat, enrollmentToken: enrollment.token };
  }, { baseUrl: apiUrl });
}

test("Inventario abre o fluxo visual seguro de assistencia remota", async ({ page }) => {
  await page.setViewportSize({ width: 948, height: 746 });
  await login(page);
  await connectLabAgent(page);
  await page.reload();

  await page.getByRole("navigation").getByRole("button", { name: /Invent.rio/ }).click();
  const machineCard = page.locator(".machine-card").filter({ hasText: "Notebook remoto E2E" });
  await expect(machineCard).toBeVisible();
  const remoteButton = machineCard.getByRole("button", { name: "Atendimento remoto" });
  await expect(remoteButton).toBeVisible();

  const cardLayout = await machineCard.evaluate((card) => {
    const actions = card.querySelector(".machine-card-actions");
    const buttons = actions
      ? actions.querySelectorAll(":scope > button, :scope > .details-menu > button, :scope > .move-menu > button")
      : [];

    return {
      width: card.getBoundingClientRect().width,
      actionsClientWidth: actions?.clientWidth || 0,
      actionsScrollWidth: actions?.scrollWidth || 0,
      buttonSizes: Array.from(buttons, (button) => {
        const bounds = button.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      })
    };
  });

  expect(cardLayout.width).toBeGreaterThanOrEqual(220);
  expect(cardLayout.actionsScrollWidth).toBeLessThanOrEqual(cardLayout.actionsClientWidth + 1);
  expect(cardLayout.buttonSizes.length).toBeGreaterThanOrEqual(3);
  cardLayout.buttonSizes.forEach(({ width, height }) => {
    expect(width).toBeCloseTo(26, 0);
    expect(height).toBeCloseTo(26, 0);
  });

  await remoteButton.click();

  const remoteDialog = page.getByRole("dialog", { name: "Assistencia remota" });
  await expect(remoteDialog).toBeVisible();
  await expect(remoteDialog.getByRole("heading", { name: "Notebook remoto E2E" })).toBeVisible();
  await expect(remoteDialog.getByLabel("Motivo do atendimento")).toBeVisible();
  await expect(remoteDialog.getByLabel("Confirme sua senha")).toBeVisible();
  await expect(remoteDialog).toContainText("O usuario precisa autorizar localmente");
  await expect(remoteDialog).toContainText("Modo privacidade e acoes administrativas permanecem indisponiveis");
});

test("sessao ativa mostra metricas, pausa a visualizacao e reconecta pelo viewer", async ({ page }) => {
  await page.setViewportSize({ width: 948, height: 746 });
  await login(page);
  const enrollment = await connectLabAgent(page);
  await page.reload();

  await page.getByRole("button", { name: /Invent.rio/ }).click();
  const machineCard = page.locator(".machine-card").filter({ hasText: "Notebook remoto E2E" });
  await expect(machineCard).toBeVisible();
  const remoteButton = machineCard.getByRole("button", { name: "Atendimento remoto" });
  await expect(remoteButton).toBeEnabled({ timeout: 10_000 });
  await remoteButton.click();

  const remoteDialog = page.getByRole("dialog", { name: "Assistencia remota" });
  await remoteDialog.getByLabel("Motivo do atendimento").fill("Verificacao de metricas em laboratorio");
  await remoteDialog.getByLabel("Confirme sua senha").fill("123456");
  await remoteDialog.getByRole("button", { name: "Solicitar atendimento" }).click();

  await expect(remoteDialog).toContainText("Aguardando");

  await page.evaluate(async ({ baseUrl, agentToken }) => {
    const pendingResponse = await fetch(`${baseUrl}/api/agents/remote-assistance/pending`, {
      headers: { authorization: `Bearer ${agentToken}` }
    });
    const { session: pending } = await pendingResponse.json();
    const consentResponse = await fetch(
      `${baseUrl}/api/agents/remote-assistance/sessions/${pending.id}/consent`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${agentToken}`,
          "x-remote-session-token": pending.sessionToken,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          granted: true,
          controlAllowed: false,
          monitors: [{ id: "display-1", name: "Tela unica", primary: true, width: 1920, height: 1080 }],
          selectedMonitorId: "display-1"
        })
      }
    );
    await consentResponse.json();
    const sendFrame = (frame) => fetch(`${baseUrl}/api/agents/remote-assistance/sessions/${pending.id}/frame`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${agentToken}`,
        "x-remote-session-token": pending.sessionToken,
        "content-type": "application/json"
      },
      body: JSON.stringify({ frame })
    });
    await sendFrame("data:image/jpeg;base64,/9j/2Q==");
    await new Promise((resolve) => setTimeout(resolve, 400));
    await sendFrame("data:image/jpeg;base64,/9j/2Qab==");
    return pending.id;
  }, { baseUrl: apiUrl, agentToken: enrollment.enrollmentToken });

  await expect(remoteDialog).toContainText("Atendimento em andamento", { timeout: 10_000 });
  await expect(remoteDialog).toContainText("unico monitor");
  await expect(remoteDialog.locator("img")).toBeVisible();
  await expect(remoteDialog).toContainText(/FPS real: \d/, { timeout: 10_000 });

  const pauseButton = remoteDialog.getByRole("button", { name: "Pausar" });
  await expect(pauseButton).toBeVisible();
  await pauseButton.click();
  await expect(remoteDialog.getByRole("button", { name: "Retomar" })).toBeVisible();
  await expect(remoteDialog).toContainText("Visualizacao pausada");

  await remoteDialog.getByRole("button", { name: "Retomar" }).click();
  await expect(remoteDialog.getByRole("button", { name: "Pausar" })).toBeVisible();

  await remoteDialog.getByRole("button", { name: "Encerrar" }).click();
  await expect(remoteDialog).toContainText("Atendimento encerrado");
});
