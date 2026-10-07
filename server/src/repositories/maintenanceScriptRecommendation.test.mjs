import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeMaintenanceScriptContent,
  inferTechnicalCategory,
  normalizeRiskLevel,
  recommendMaintenanceScripts,
  scoreMaintenanceScriptForContext,
  toRecommendedScriptResponse
} from "../services/maintenanceScripts/maintenanceScriptsFacade.js";

const baseScript = {
  id: "script-base",
  name: "Script base",
  active: true,
  riskLevel: "low",
  tags: [],
  relatedAlertTypes: [],
  relatedProblemTypes: [],
  recommendedForCategories: []
};

test("script ausente ou inativo nao e pontuado", () => {
  assert.equal(scoreMaintenanceScriptForContext(null, { alertType: "disk" }), null);
  assert.equal(scoreMaintenanceScriptForContext({ ...baseScript, active: false }, {}), null);
  assert.ok(scoreMaintenanceScriptForContext({ ...baseScript, active: undefined }, {}));
  assert.ok(scoreMaintenanceScriptForContext(baseScript));
});

test("filtra scripts que declaram sistemas operacionais incompativeis com o ativo", () => {
  const windowsOnly = { ...baseScript, supportedOperatingSystems: ["Windows 11"] };

  assert.equal(scoreMaintenanceScriptForContext(windowsOnly, { operatingSystem: "Ubuntu 22.04" }), null);
  assert.ok(scoreMaintenanceScriptForContext(windowsOnly, { operatingSystem: "Microsoft Windows 11 Pro" }));
  assert.ok(
    scoreMaintenanceScriptForContext(windowsOnly, { operatingSystem: "Windows" }),
    "o sistema do ativo contido no declarado (ou o inverso) e compativel"
  );
  assert.ok(scoreMaintenanceScriptForContext(windowsOnly, {}), "sem sistema no contexto nao filtra");
  assert.ok(
    scoreMaintenanceScriptForContext({ ...baseScript, operatingSystems: "Windows 10" }, { operatingSystem: "windows 10 pro" }),
    "aceita o alias operatingSystems"
  );
  assert.ok(scoreMaintenanceScriptForContext({ ...baseScript, supportedOperatingSystems: [] }, { operatingSystem: "Linux" }));
});

test("pontua cada criterio e explica o motivo da recomendacao", () => {
  const script = {
    ...baseScript,
    name: "Disco em Windows 11 com servico",
    description: "Verifica disco em ativo desktop",
    category: "Armazenamento",
    alertType: "disk_usage",
    problemType: "Disco cheio",
    tags: ["disco", "ssd"],
    relatedAlertTypes: ["disk_usage"],
    relatedProblemTypes: ["Disco cheio"],
    recommendedForCategories: ["Armazenamento"]
  };
  const result = scoreMaintenanceScriptForContext(script, {
    alertType: "disk_usage",
    problemType: "Disco cheio",
    category: "Armazenamento",
    title: "Disco quase cheio no ssd",
    assetType: "desktop",
    operatingSystem: "Windows 11",
    tags: ["disco"]
  });

  assert.equal(result.isRecommended, true);
  assert.ok(result.recommendationScore >= 40 + 35 + 25 + 20 + 20);
  assert.match(result.recommendationReason, /tipo de aviso compatível/);
  assert.match(result.recommendationReason, /tipo de problema compatível/);
  assert.match(result.recommendationReason, /categoria compatível/);
  assert.match(result.recommendationReason, /tags relacionadas: disco, ssd/);
  assert.match(result.recommendationReason, /tipo de ativo compativel/);
  assert.match(result.recommendationReason, /sistema operacional compativel/);
  assert.match(result.recommendationReason, /palavras-chave: disco/);
  assert.deepEqual(result.compatibilityWarnings, []);
  assert.equal(result.id, script.id, "o script original e preservado no resultado");

  const noMatch = scoreMaintenanceScriptForContext(baseScript, { alertType: "xyz" });
  assert.equal(noMatch.recommendationScore, 0);
  assert.equal(noMatch.isRecommended, false);
  assert.equal(noMatch.recommendationReason, "Sem correspondência forte com o contexto do aviso.");
});

test("avisos de compatibilidade e penalidade para risco elevado", () => {
  const context = { alertType: "disk_usage", title: "disco" };
  const plain = scoreMaintenanceScriptForContext({ ...baseScript, relatedAlertTypes: ["disk_usage"] }, context);
  const risky = scoreMaintenanceScriptForContext(
    { ...baseScript, relatedAlertTypes: ["disk_usage"], riskLevel: "critical", requiresAdmin: true, requiresLoggedUser: true },
    context
  );

  assert.equal(risky.recommendationScore, plain.recommendationScore - 5);
  assert.deepEqual(risky.compatibilityWarnings, [
    "Pode exigir permissão administrativa em execução futura.",
    "Pode exigir usuário logado no ativo em execução futura.",
    "Script de risco elevado: revisar antes de usar."
  ]);

  const floor = scoreMaintenanceScriptForContext({ ...baseScript, riskLevel: "high" }, {});
  assert.equal(floor.recommendationScore, 0, "a penalidade nunca deixa a pontuacao negativa");
  assert.equal(floor.isRecommended, false);

  const unknownRisk = scoreMaintenanceScriptForContext({ ...baseScript, riskLevel: "inexistente", suggestedRiskLevel: undefined }, {});
  assert.deepEqual(unknownRisk.compatibilityWarnings, [], "risco desconhecido assume medio");
});

test("ordena por pontuacao e desempata pelo nome", () => {
  const scripts = [
    { ...baseScript, id: "b", name: "Beta", tags: ["disco"] },
    { ...baseScript, id: "a", name: "Alfa", tags: ["disco"] },
    { ...baseScript, id: "c", name: "Gama", tags: ["disco", "ssd"] },
    { ...baseScript, id: "z", name: "Zeta" },
    { ...baseScript, id: "off", name: "Inativo", active: false, tags: ["disco"] },
    null
  ];

  const result = recommendMaintenanceScripts({ title: "disco ssd cheio", tags: ["ssd"] }, scripts);
  assert.deepEqual(
    result.recommended.map((item) => item.id),
    ["c", "a", "b"]
  );
  assert.deepEqual(
    result.others.map((item) => item.id),
    ["z"]
  );
  assert.deepEqual(recommendMaintenanceScripts().recommended, []);
  assert.deepEqual(recommendMaintenanceScripts({}, []).others, []);
});

test("infere a categoria tecnica a partir do texto do aviso", () => {
  const cases = [
    [{ title: "Disco quase cheio" }, "Armazenamento"],
    [{ alertType: "storage_low" }, "Armazenamento"],
    [{ description: "Uso de memória alto" }, "Memoria"],
    [{ metric: "ram_usage" }, "Memoria"],
    [{ metric: "cpu_usage" }, "Processamento"],
    [{ title: "Processador saturado" }, "Processamento"],
    [{ title: "Maquina offline" }, "Rede"],
    [{ alertType: "ping_failure" }, "Rede"],
    [{ title: "Impressora sem papel" }, "Impressoras"],
    [{ problemType: "Servico parado" }, "Servicos"],
    [{ technicalCategory: "Seguranca" }, "Seguranca"],
    [{ category: "Outros" }, "Outros"],
    [{}, ""]
  ];
  for (const [source, expected] of cases) {
    assert.equal(inferTechnicalCategory(source), expected, JSON.stringify(source));
  }
  assert.equal(inferTechnicalCategory(), "");
});

test("resposta resumida de recomendacao aplica valores padrao", () => {
  assert.deepEqual(
    toRecommendedScriptResponse({ id: "x", name: "Script X", category: "Rede", riskLevel: "low", estimatedSummary: "Resumo" }),
    {
      id: "x",
      name: "Script X",
      category: "Rede",
      riskLevel: "low",
      estimatedSummary: "Resumo",
      recommendationScore: 0,
      recommendationReason: "",
      compatibilityWarnings: [],
      requiresLoggedUser: false,
      requiresAdmin: false,
      supportedVariables: [],
      isRecommended: false,
      matchedAssetIds: [],
      matchedAlertIds: []
    }
  );

  const full = toRecommendedScriptResponse({
    id: "y",
    name: "Script Y",
    recommendationScore: 55,
    recommendationReason: "Motivo",
    compatibilityWarnings: ["aviso"],
    requiresLoggedUser: true,
    requiresAdmin: true,
    supportedVariables: ["HOSTNAME"],
    isRecommended: true,
    matchedAssetIds: ["a1"],
    matchedAlertIds: ["al1"],
    content: "nao deve vazar"
  });
  assert.equal(full.recommendationScore, 55);
  assert.equal(full.requiresAdmin, true);
  assert.deepEqual(full.matchedAssetIds, ["a1"]);
  assert.equal("content" in full, false, "o conteudo do script nao faz parte da resposta de recomendacao");
});

test("normaliza o nivel de risco com valor padrao", () => {
  assert.equal(normalizeRiskLevel("HIGH"), "high");
  assert.equal(normalizeRiskLevel(" critical "), "critical");
  assert.equal(normalizeRiskLevel("xyz"), "medium");
  assert.equal(normalizeRiskLevel("", "low"), "low");
  assert.equal(normalizeRiskLevel(undefined, "high"), "high");
  assert.equal(normalizeRiskLevel("xyz", "low"), "low");
});

test("analise do conteudo limita o tamanho e classifica o maior risco encontrado", () => {
  const long = analyzeMaintenanceScriptContent(`echo ok\n${"x".repeat(20000)}`);
  assert.equal(long.safePreview.length, 10000);

  const nothing = analyzeMaintenanceScriptContent(undefined);
  assert.equal(nothing.suggestedRiskLevel, "medium");
  assert.deepEqual(nothing.detectedActions, []);

  const mixed = analyzeMaintenanceScriptContent("ipconfig /flushdns\nformat c:\nwhoami\n{{HOSTNAME}} {{ X1 }}");
  assert.equal(mixed.suggestedRiskLevel, "critical");
  assert.deepEqual(mixed.unknownVariables, ["{{X1}}"]);
  assert.deepEqual(mixed.detectedVariables, ["{{HOSTNAME}}"]);
  assert.equal(new Set(mixed.detectedActions).size, mixed.detectedActions.length, "acoes repetidas sao unificadas");
  assert.equal(mixed.allowedVariables.length, 8);
});
