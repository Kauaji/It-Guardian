import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderMetrics } from "./metrics.js";
import "../middleware/rateLimitMiddleware.js";
import "../database.js";

const rules = readFileSync(new URL("../../../ops/prometheus/alerts.yml", import.meta.url), "utf8");
const runbook = readFileSync(new URL("../../../docs/OBSERVABILIDADE.md", import.meta.url), "utf8");

test("toda metrica citada nas regras de alerta existe no registro de metricas", () => {
  const exposed = renderMetrics();
  const cited = new Set([...rules.matchAll(/\bitguardian_[a-z0-9_]+/g)].map((match) => match[0].replace(/_(bucket|sum|count)$/, "")));
  assert.ok(cited.size >= 6);
  for (const name of cited) {
    assert.ok(exposed.includes(name), `metrica ${name} citada em alerts.yml nao existe no /metrics`);
  }
});

test("todo alerta tem severidade, resumo e runbook que aponta para uma secao existente", () => {
  const alerts = [...rules.matchAll(/- alert: (\w+)/g)].map((match) => match[1]);
  assert.ok(alerts.length >= 8);
  const runbooks = [...rules.matchAll(/runbook: "docs\/OBSERVABILIDADE\.md#([a-z0-9-]+)"/g)].map((match) => match[1]);
  assert.equal(runbooks.length, alerts.length, "cada alerta precisa de runbook");
  assert.equal([...rules.matchAll(/severity: (critical|warning)/g)].length, alerts.length);
  const headings = new Set(
    [...runbook.matchAll(/^#{2,3} (.+)$/gm)].map((match) =>
      match[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim().replace(/ +/g, "-")
    )
  );
  for (const anchor of runbooks) assert.ok(headings.has(anchor), `secao ${anchor} ausente em docs/OBSERVABILIDADE.md`);
});
