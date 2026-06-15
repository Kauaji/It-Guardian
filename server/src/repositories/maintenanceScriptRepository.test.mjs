import test from "node:test";
import assert from "node:assert/strict";

import {
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
