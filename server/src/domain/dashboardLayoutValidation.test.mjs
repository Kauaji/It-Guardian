import assert from "node:assert/strict";
import test from "node:test";
import { validateDashboardLayout } from "./dashboardLayoutValidation.js";

const knownWidgetTypes = new Set(["status_overview", "metric_history_cpu"]);

function widget(overrides = {}) {
  return {
    id: "widget-1",
    type: "status_overview",
    x: 0,
    y: 0,
    w: "m",
    h: "s",
    refreshIntervalSeconds: 60,
    config: {},
    ...overrides
  };
}

test("aceita um layout valido", () => {
  assert.equal(validateDashboardLayout({ widgets: [widget()] }, { knownWidgetTypes }), true);
});

test("aceita um layout sem nenhum widget", () => {
  assert.equal(validateDashboardLayout({ widgets: [] }, { knownWidgetTypes }), true);
});

test("rejeita quando nao ha lista de widgets", () => {
  assert.throws(() => validateDashboardLayout({}, { knownWidgetTypes }), /lista de widgets/);
  assert.throws(() => validateDashboardLayout(null, { knownWidgetTypes }), /lista de widgets/);
});

test("rejeita tipo de widget desconhecido", () => {
  assert.throws(
    () => validateDashboardLayout({ widgets: [widget({ type: "widget_inexistente" })] }, { knownWidgetTypes }),
    /tipo desconhecido/
  );
});

test("rejeita posicao invalida (x/y nao inteiros ou negativos)", () => {
  assert.throws(() => validateDashboardLayout({ widgets: [widget({ x: -1 })] }, { knownWidgetTypes }), /posicao invalida/);
  assert.throws(() => validateDashboardLayout({ widgets: [widget({ y: 1.5 })] }, { knownWidgetTypes }), /posicao invalida/);
  assert.throws(() => validateDashboardLayout({ widgets: [widget({ x: "0" })] }, { knownWidgetTypes }), /posicao invalida/);
});

test("rejeita tier de largura/altura fora do conjunto discreto", () => {
  assert.throws(() => validateDashboardLayout({ widgets: [widget({ w: "xxl" })] }, { knownWidgetTypes }), /largura invalida/);
  assert.throws(() => validateDashboardLayout({ widgets: [widget({ h: "xl" })] }, { knownWidgetTypes }), /altura invalida/);
});

test("rejeita refreshIntervalSeconds abaixo de 30s", () => {
  assert.throws(
    () => validateDashboardLayout({ widgets: [widget({ refreshIntervalSeconds: 29 })] }, { knownWidgetTypes }),
    /pelo menos 30s/
  );
  assert.throws(
    () => validateDashboardLayout({ widgets: [widget({ refreshIntervalSeconds: 30.5 })] }, { knownWidgetTypes }),
    /pelo menos 30s/
  );
});

test("aceita refreshIntervalSeconds igual a 30s (limite inclusivo)", () => {
  assert.equal(
    validateDashboardLayout({ widgets: [widget({ refreshIntervalSeconds: 30 })] }, { knownWidgetTypes }),
    true
  );
});

test("rejeita mais de 30 widgets", () => {
  const widgets = Array.from({ length: 31 }, (_, index) => widget({ id: `widget-${index}` }));
  assert.throws(() => validateDashboardLayout({ widgets }, { knownWidgetTypes }), /no maximo 30 widgets/);
});

test("aceita exatamente 30 widgets", () => {
  const widgets = Array.from({ length: 30 }, (_, index) => widget({ id: `widget-${index}` }));
  assert.equal(validateDashboardLayout({ widgets }, { knownWidgetTypes }), true);
});

test("rejeita ids duplicados", () => {
  assert.throws(
    () => validateDashboardLayout({ widgets: [widget(), widget()] }, { knownWidgetTypes }),
    /duplicado/
  );
});

test("rejeita widget sem id", () => {
  assert.throws(
    () => validateDashboardLayout({ widgets: [widget({ id: "" })] }, { knownWidgetTypes }),
    /sem identificador/
  );
});

test("rejeita config que nao seja um objeto simples", () => {
  assert.throws(
    () => validateDashboardLayout({ widgets: [widget({ config: "nao-e-objeto" })] }, { knownWidgetTypes }),
    /configuracao invalida/
  );
  assert.throws(
    () => validateDashboardLayout({ widgets: [widget({ config: ["array"] })] }, { knownWidgetTypes }),
    /configuracao invalida/
  );
});

test("aceita um titulo customizado dentro do limite, rejeita alem dele ou de tipo errado", () => {
  assert.equal(
    validateDashboardLayout({ widgets: [widget({ title: "Meu widget" })] }, { knownWidgetTypes }),
    true
  );
  assert.throws(
    () => validateDashboardLayout({ widgets: [widget({ title: "x".repeat(61) })] }, { knownWidgetTypes }),
    /titulo invalido/
  );
  assert.throws(
    () => validateDashboardLayout({ widgets: [widget({ title: 123 })] }, { knownWidgetTypes }),
    /titulo invalido/
  );
});

test("acumula multiplos erros numa unica mensagem", () => {
  try {
    validateDashboardLayout({ widgets: [widget({ x: -1, w: "xxl" })] }, { knownWidgetTypes });
    assert.fail("deveria ter lancado");
  } catch (error) {
    assert.match(error.message, /posicao invalida/);
    assert.match(error.message, /largura invalida/);
    assert.equal(error.statusCode, 400);
  }
});
