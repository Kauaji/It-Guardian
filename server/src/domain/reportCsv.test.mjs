import assert from "node:assert/strict";
import test from "node:test";

import { escapeCsvValue, REPORT_COLUMNS, toCsv } from "./reportCsv.js";

test("escapeCsvValue coloca entre aspas valor com ponto-e-virgula, aspas ou quebra de linha", () => {
  assert.equal(escapeCsvValue("a;b"), '"a;b"');
  assert.equal(escapeCsvValue('a"b'), '"a""b"');
  assert.equal(escapeCsvValue("a\nb"), '"a\nb"');
  assert.equal(escapeCsvValue("texto simples"), "texto simples");
});

test("escapeCsvValue neutraliza injecao de formula prefixando apostrofo", () => {
  assert.equal(escapeCsvValue("=SOMA(A1:A2)"), "'=SOMA(A1:A2)");
  assert.equal(escapeCsvValue("+1+1"), "'+1+1");
  assert.equal(escapeCsvValue("-1"), "'-1");
  assert.equal(escapeCsvValue("@cmd"), "'@cmd");
  assert.equal(escapeCsvValue("texto normal"), "texto normal");
});

test("escapeCsvValue trata null/undefined como vazio e booleano como Sim/Nao", () => {
  assert.equal(escapeCsvValue(null), "");
  assert.equal(escapeCsvValue(undefined), "");
  assert.equal(escapeCsvValue(true), "Sim");
  assert.equal(escapeCsvValue(false), "Nao");
});

test("escapeCsvValue formata um objeto Date como ISO, nunca como String(Date) verboso e dependente de timezone local", () => {
  const date = new Date("2026-08-21T12:20:30.489Z");
  assert.equal(escapeCsvValue(date), "2026-08-21T12:20:30.489Z");
  assert.doesNotMatch(escapeCsvValue(date), /GMT|\(.*Hor.rio/);
});

test("toCsv gera BOM, cabecalho em portugues, delimitador ; e quebra CRLF", () => {
  const columns = [{ key: "a", header: "Coluna A" }, { key: "b", header: "Coluna B" }];
  const rows = [{ a: "1", b: "2" }];
  const csv = toCsv(columns, rows);

  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /Coluna A;Coluna B\r\n/);
  assert.match(csv, /1;2\r\n/);
});

test("REPORT_COLUMNS nunca inclui uma chave sensivel (token, stdout/stderr integral, conteudo de script)", () => {
  const bannedKeys = /token|password|secret|iceServers|script_content|scriptcontent|frame|chat/i;

  for (const [type, columns] of Object.entries(REPORT_COLUMNS)) {
    for (const column of columns) {
      assert.doesNotMatch(column.key, bannedKeys, `coluna suspeita em ${type}: ${column.key}`);
      assert.notEqual(column.key, "stdout", `${type} nao deve exportar stdout integral`);
      assert.notEqual(column.key, "stderr", `${type} nao deve exportar stderr integral`);
    }
  }
});

test("toCsv so usa as colunas do allowlist, mesmo se a linha tiver chaves extras sensiveis", () => {
  const columns = REPORT_COLUMNS.remote_assistance;
  const rows = [
    {
      assetName: "PC-01",
      technicianName: "Joao",
      statusLabel: "Encerrada",
      connectionModeLabel: "WebRTC",
      consentStatus: "granted",
      requestedAt: "2026-08-01T00:00:00Z",
      startedAt: "2026-08-01T00:01:00Z",
      endedAt: "2026-08-01T00:10:00Z",
      durationMinutes: 9,
      endReason: "technician_ended",
      agentToken: "should-not-appear",
      viewerToken: "should-not-appear",
      sessionToken: "should-not-appear"
    }
  ];

  const csv = toCsv(columns, rows);
  assert.doesNotMatch(csv, /should-not-appear/);
});
