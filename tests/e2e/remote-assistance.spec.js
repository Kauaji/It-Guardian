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
    return heartbeatResponse.json();
  }, { baseUrl: apiUrl });
}

test("Inventario abre o fluxo visual seguro de assistencia remota", async ({ page }) => {
  await login(page);
  await connectLabAgent(page);
  await page.reload();

  await page.getByRole("button", { name: /Invent.rio/ }).click();
  const machineCard = page.locator(".machine-card").filter({ hasText: "Notebook remoto E2E" });
  await expect(machineCard).toBeVisible();
  const remoteButton = machineCard.getByRole("button", { name: "Atendimento remoto" });
  await expect(remoteButton).toBeVisible();
  await remoteButton.click();

  const remoteDialog = page.getByRole("dialog", { name: "Assistencia remota" });
  await expect(remoteDialog).toBeVisible();
  await expect(remoteDialog.getByRole("heading", { name: "Notebook remoto E2E" })).toBeVisible();
  await expect(remoteDialog.getByLabel("Motivo do atendimento")).toBeVisible();
  await expect(remoteDialog.getByLabel("Confirme sua senha")).toBeVisible();
  await expect(remoteDialog).toContainText("O usuario precisa autorizar localmente");
  await expect(remoteDialog).toContainText("Modo privacidade e acoes administrativas permanecem indisponiveis");
});
