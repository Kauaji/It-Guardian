import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { isScheduleLinkedToPlan } from "./preventiveAutomationRepository.js";
import {
  automationMachineStatus,
  buildAutomationManagementGroups,
  shouldShowAutomationManagement
} from "../../../client/src/components/automation/automationUtils.js";

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const machines = [
  {
    assetId: "asset-1",
    assetName: "NB-DIRETORIA-01",
    assetType: "notebook",
    operatingSystem: "Windows 11",
    loggedUser: "diretoria",
    segmentId: "segment-1",
    groupId: "group-1",
    plans: [
      { id: "plan-1", planName: "Limpeza de disco", active: true, nextRunAt: "2026-07-01T11:00:00.000Z" },
      { id: "plan-2", planName: "Inventário semanal", active: true, nextRunAt: "2026-07-02T11:00:00.000Z" }
    ]
  },
  {
    assetId: "asset-2",
    assetName: "WS-FIN-07",
    segmentId: "segment-1",
    groupId: "group-1",
    plans: [{ id: "plan-3", planName: "Plano inativo", active: false }]
  },
  {
    assetId: "asset-3",
    assetName: "SRV-DB-01",
    segmentId: "segment-2",
    groupId: "group-2",
    plans: [{ id: "plan-4", planName: "Banco diário", active: true, latestRun: { status: "error" } }]
  },
  {
    assetId: "asset-4",
    assetName: "IMP-RH-01",
    segmentId: "segment-2",
    groupId: "group-2",
    plans: [{ id: "plan-5", planName: "Fila de impressão", active: true, nextRunAt: null }]
  }
];

const locations = {
  devices: [],
  segments: [
    { id: "segment-1", name: "Diretoria", groupId: "group-1", tabId: "tab-1" },
    { id: "segment-2", name: "Servidores", groupId: "group-2", tabId: "tab-1" }
  ],
  groups: [
    { id: "group-1", name: "Estações", tabId: "tab-1" },
    { id: "group-2", name: "Infraestrutura", tabId: "tab-1" }
  ],
  tabs: [{ id: "tab-1", name: "Matriz" }]
};

test("agenda explícita pertence ao plano asset_list enquanto o ativo estiver vinculado", () => {
  assert.equal(
    isScheduleLinkedToPlan(
      { scopeType: "asset_list", assetIds: ["asset-1"], excludedAssetIds: [] },
      { assetId: "asset-1" }
    ),
    true
  );
});

test("agenda removida do asset_list não volta para a listagem", () => {
  assert.equal(
    isScheduleLinkedToPlan(
      { scopeType: "asset_list", assetIds: ["asset-2"], excludedAssetIds: [] },
      { assetId: "asset-1" }
    ),
    false
  );
});

test("ativo excluído de um escopo amplo não aparece no gerenciamento", () => {
  assert.equal(
    isScheduleLinkedToPlan(
      { scopeType: "segment", assetIds: [], excludedAssetIds: ["asset-1"] },
      { assetId: "asset-1" }
    ),
    false
  );
});

test("máquina com vários planos aparece uma vez e preserva os indicadores", () => {
  const result = buildAutomationManagementGroups({ machines, ...locations, status: "all" });
  const listed = result.flatMap((group) => group.machines.map(({ machine }) => machine));
  assert.equal(listed.filter((machine) => machine.assetId === "asset-1").length, 1);
  assert.equal(listed.find((machine) => machine.assetId === "asset-1").plans.length, 2);
});

test("filtro ativo mostra somente máquinas com automação ativa e agendada", () => {
  const result = buildAutomationManagementGroups({ machines, ...locations, status: "active" });
  assert.deepEqual(
    result.flatMap((group) => group.machines.map(({ machine }) => machine.assetId)),
    ["asset-1"]
  );
});

test("filtros de inativo, erro e sem agenda são independentes", () => {
  const idsFor = (status) => buildAutomationManagementGroups({ machines, ...locations, status })
    .flatMap((group) => group.machines.map(({ machine }) => machine.assetId));
  assert.deepEqual(idsFor("inactive"), ["asset-2"]);
  assert.deepEqual(idsFor("error"), ["asset-3"]);
  assert.deepEqual(idsFor("without_schedule"), ["asset-4"]);
});

test("busca encontra máquina pelo nome do plano", () => {
  const result = buildAutomationManagementGroups({
    machines,
    ...locations,
    status: "all",
    search: "limpeza de disco"
  });
  assert.deepEqual(result.flatMap((group) => group.machines.map(({ machine }) => machine.assetId)), ["asset-1"]);
});

test("agrupamento usa aba, grupo e segmento", () => {
  const result = buildAutomationManagementGroups({ machines, ...locations, status: "all" });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((group) => [group.tabName, group.groupName, group.segmentName]), [
    ["Matriz", "Estações", "Diretoria"],
    ["Matriz", "Infraestrutura", "Servidores"]
  ]);
});

test("aba de automatizações exige permissão e ao menos um plano", () => {
  assert.equal(shouldShowAutomationManagement(true, 1), true);
  assert.equal(shouldShowAutomationManagement(true, 0), false);
  assert.equal(shouldShowAutomationManagement(false, 3), false);
});

test("classificação de status prioriza erro e ausência de agenda", () => {
  assert.equal(automationMachineStatus(machines[2]), "error");
  assert.equal(automationMachineStatus(machines[3]), "without_schedule");
  assert.equal(automationMachineStatus(machines[1]), "inactive");
});

test("listagem de gerenciamento busca dados relacionados em lote", () => {
  const repository = source("./preventiveAutomationRepository.js");
  const body = repository.slice(repository.indexOf("export async function listPreventiveAutomationManagement"));
  assert.match(body, /Promise\.all\(\[/);
  assert.match(body, /preventive_automation_overrides/);
  assert.match(body, /preventive_automation_asset_schedules/);
  assert.match(body, /preventive_automation_runs/);
  assert.match(body, /maintenance_scripts/);
  assert.match(body, /listDevices\(\{\}\)/);
});

test("exclusão do plano é lógica, transacional e preserva histórico", () => {
  const repository = source("./preventiveAutomationRepository.js");
  const start = repository.indexOf("export async function deletePreventiveAutomationPlan");
  const end = repository.indexOf("function latestRunKey", start);
  const body = repository.slice(start, end);
  assert.match(body, /deleted_at\s*=\s*NOW\(\)/);
  assert.match(body, /preventive_automation_asset_schedules[\s\S]*active\s*=\s*FALSE/);
  assert.match(body, /preventive_automation_deleted/);
  assert.doesNotMatch(body, /DELETE\s+FROM\s+preventive_automation_plans/i);
});

test("remoção de máquina desativa agenda e registra histórico e auditoria", () => {
  const repository = source("./preventiveAutomationRepository.js");
  const start = repository.indexOf("export async function removeAssetFromPreventiveAutomationPlan");
  const end = repository.indexOf("export function resolveEffectiveRecurrence", start);
  const body = repository.slice(start, end);
  assert.match(body, /preventive_automation_asset_schedules[\s\S]*active\s*=\s*FALSE/);
  assert.match(body, /preventive_automation_removed_from_asset/);
  assert.match(body, /addAssetHistory/);
  assert.match(body, /remainingAssetCount/);
});

test("override individual usa a chave única plan_id mais target_key", () => {
  const database = source("../database.js");
  const repository = source("./preventiveAutomationRepository.js");
  assert.match(database, /UNIQUE INDEX IF NOT EXISTS idx_preventive_automation_overrides_target[\s\S]*plan_id,\s*target_key/);
  assert.match(repository, /`asset:\$\{assetId\}`/);
});

test("rotas protegem exclusão, override e remoção de ativo no backend", () => {
  const routes = source("../routes/preventiveAutomationRoutes.js");
  assert.match(routes, /preventive_automation\.delete/);
  assert.match(routes, /preventive_automation\.remove_asset/);
  assert.match(routes, /preventive_automation\.manage_asset_override/);
});

test("migração cria exclusão lógica e índices de gerenciamento", () => {
  const database = source("../database.js");
  assert.match(database, /deleted_at TIMESTAMPTZ/);
  assert.match(database, /idx_preventive_automation_plans_deleted_at/);
  assert.match(database, /idx_preventive_automation_plans_active/);
  assert.match(database, /idx_preventive_automation_asset_schedules_asset/);
  assert.match(database, /idx_preventive_automation_asset_schedules_plan/);
});

test("indicadores ignoram planos excluídos", () => {
  const repository = source("./automationIndicatorRepository.js");
  assert.match(repository, /plans\.deleted_at\s+IS\s+NULL/);
});

test("frontend oferece loading, erro, vazio e tentativa novamente", () => {
  const component = source("../../../client/src/components/automation/AutomationManagementView.jsx");
  assert.match(component, /automation-management-skeleton/);
  assert.match(component, /automation-management-error/);
  assert.match(component, /Tentar novamente/);
  assert.match(component, /Nenhuma máquina com automatização encontrada/);
});

test("bolinhas têm tooltip, aria-label, Escape e devolução de foco", () => {
  const component = source("../../../client/src/components/AutomationIndicatorDots.jsx");
  assert.match(component, /title=\{formatAutomationIndicatorLabel\(indicator\)\}/);
  assert.match(component, /aria-label=\{formatAutomationIndicatorLabel\(indicator\)\}/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /triggerRef\.current\?\.focus\(\)/);
});

test("modais de plano e máquina fecham com Escape", () => {
  const plan = source("../../../client/src/components/automation/AutomationPlanDetails.jsx");
  const machine = source("../../../client/src/components/automation/AutomationMachineDetails.jsx");
  assert.match(plan, /event\.key === "Escape"/);
  assert.match(machine, /event\.key === "Escape"/);
});

test("detalhes da máquina incluem override, remoção e histórico recente", () => {
  const component = source("../../../client/src/components/automation/AutomationMachineDetails.jsx");
  assert.match(component, /Definir recorrência personalizada/);
  assert.match(component, /Usar recorrência padrão do plano/);
  assert.match(component, /Remover plano da máquina/);
  assert.match(component, /Histórico recente/);
});

test("detalhes gerais exigem confirmação forte para excluir", () => {
  const component = source("../../../client/src/components/automation/AutomationPlanDetails.jsx");
  assert.match(component, /Digite o nome do plano para confirmar/);
  assert.match(component, /deleteConfirmation !== plan\.name/);
  assert.match(component, /histórico será preservado/);
});

test("tela de gerenciamento reutiliza AutomationIndicatorDots", () => {
  const component = source("../../../client/src/components/automation/AutomationMachineList.jsx");
  assert.match(component, /AutomationIndicatorDots/);
  assert.doesNotMatch(component, /automation-indicator-dot-button/);
});

test("App mantém gerenciamento fora da composição visual principal", () => {
  const app = source("../../../client/src/App.jsx");
  assert.match(app, /<AutomationManagementView/);
  assert.match(app, /canShowAutomationManagement/);
  assert.match(app, /alertActiveTab === "automation"/);
});

test("nenhuma primitiva de execução real foi introduzida na área de gerenciamento", () => {
  const combined = [
    source("./preventiveAutomationRepository.js"),
    source("../../../client/src/components/automation/AutomationManagementView.jsx"),
    source("../../../client/src/components/automation/AutomationPlanDetails.jsx")
  ].join("\n");
  assert.doesNotMatch(combined, /child_process|\bexecFile\s*\(|\bspawn\s*\(|shell\s*:\s*true|\beval\s*\(/);
});
