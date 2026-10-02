import assert from "node:assert/strict";
import test from "node:test";

import { buildRecommendationContexts, rankScriptsForContexts } from "./recommendationContexts.js";

const devices = [
  { id: "pc-1", type: "desktop", operatingSystem: "Windows 11", segmentName: "Financeiro", groupName: "Matriz" },
  { id: "pc-2", type: "notebook", operatingSystem: "Windows 10", segmentName: "RH", groupName: "Filial" }
];
const diskAlert = { id: "al-1", assetId: "pc-1", type: "disk_usage", metric: "disk", severity: "high", title: "Disco cheio", description: "90%" };
const orphanAlert = { id: "al-2", assetId: null, type: "ping_failure", metric: "ping", severity: "medium", title: "Sem resposta", description: "" };

test("sem ativos nem avisos devolve um unico contexto padrao com as tags do contexto livre", () => {
  assert.deepEqual(buildRecommendationContexts({}, devices, [], []), [{ tags: [] }]);
  assert.deepEqual(
    buildRecommendationContexts({ context: { title: "Livre", tags: ["x"] } }, devices, [], []),
    [{ title: "Livre", tags: ["x"] }]
  );
});

test("cada ativo selecionado gera um contexto por aviso ativo ou um contexto sem aviso", () => {
  const contexts = buildRecommendationContexts({ assetIds: ["pc-1", "pc-2", "pc-3"] }, devices, [diskAlert], []);

  assert.equal(contexts.length, 2, "ativos desconhecidos nao geram contexto");
  const [withAlert, withoutAlert] = contexts;
  assert.equal(withAlert.assetId, "pc-1");
  assert.equal(withAlert.alertId, "al-1");
  assert.equal(withAlert.alertType, "disk_usage");
  assert.equal(withAlert.technicalCategory, "Armazenamento");
  assert.equal(withAlert.assetType, "desktop");
  assert.equal(withAlert.operatingSystem, "Windows 11");
  assert.equal(withAlert.segmentName, "Financeiro");
  assert.equal(withoutAlert.assetId, "pc-2");
  assert.equal(withoutAlert.alertId, null);
  assert.equal(withoutAlert.alertType, "");
});

test("avisos selecionados fora dos ativos entram como contextos proprios", () => {
  const contexts = buildRecommendationContexts({ assetIds: ["pc-1"], alertIds: ["al-2"] }, devices, [diskAlert], [orphanAlert]);

  assert.deepEqual(contexts.map((context) => context.alertId), ["al-1", "al-2"]);
  const orphan = contexts[1];
  assert.equal(orphan.assetId, null);
  assert.equal(orphan.technicalCategory, "Rede");
  assert.deepEqual(orphan.tags, []);
});

test("valores do contexto livre prevalecem sobre os inferidos do ativo e do aviso", () => {
  const [context] = buildRecommendationContexts(
    { assetIds: ["pc-1"], context: { alertType: "custom", title: "Meu titulo", assetType: "servidor", tags: ["a"], extra: 1 } },
    devices,
    [diskAlert],
    []
  );

  assert.equal(context.alertType, "custom");
  assert.equal(context.title, "Meu titulo");
  assert.equal(context.assetType, "servidor");
  assert.deepEqual(context.tags, ["a"]);
  assert.equal(context.extra, 1);
  assert.equal(context.metric, "disk", "o que nao foi informado vem do aviso");
});

test("ids de ativo podem ser numericos", () => {
  const contexts = buildRecommendationContexts({ assetIds: [7] }, [{ id: "7" }], [{ id: 9, assetId: 7, type: "cpu" }], []);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].alertId, 9);
});

test("ranqueia scripts pelo melhor contexto e lista ativos e avisos casados", () => {
  const scripts = [
    { id: "disk", name: "Disco", active: true, tags: ["disco"], relatedAlertTypes: ["disk_usage"] },
    { id: "net", name: "Rede", active: true, tags: ["rede"], relatedAlertTypes: ["ping_failure"] },
    { id: "idle", name: "Ocioso", active: true },
    { id: "off", name: "Desligado", active: false, relatedAlertTypes: ["disk_usage"] }
  ];
  const contexts = buildRecommendationContexts({ assetIds: ["pc-1"], alertIds: ["al-2"] }, devices, [diskAlert], [orphanAlert]);
  const ranked = rankScriptsForContexts(scripts, contexts);

  assert.deepEqual(ranked.map((item) => item.id).slice(0, 2).sort(), ["disk", "net"]);
  assert.equal(ranked.at(-1).id, "idle", "sem correspondencia fica por ultimo");
  assert.ok(ranked[0].recommendationScore >= ranked[1].recommendationScore);
  assert.ok(!ranked.some((item) => item.id === "off"));
  const disk = ranked.find((item) => item.id === "disk");
  assert.deepEqual(disk.matchedAssetIds, ["pc-1"]);
  assert.deepEqual([...disk.matchedAlertIds].sort(), ["al-1", "al-2"]);
  assert.equal(disk.matchedAlertIds[0], "al-1", "o contexto de melhor pontuacao vem primeiro");
  assert.deepEqual(rankScriptsForContexts([], contexts), []);
});
