import assert from "node:assert/strict";
import test from "node:test";

import { bucketSamples, resolvePeriod, resolveSince, summarize } from "./assetMetricHistoryService.js";

test("resolvePeriod aceita os 5 periodos validos e cai em 24h para qualquer outro valor", () => {
  for (const period of ["1h", "6h", "24h", "7d", "30d"]) {
    assert.equal(resolvePeriod(period), period);
  }
  assert.equal(resolvePeriod("invalido"), "24h");
  assert.equal(resolvePeriod(undefined), "24h");
});

test("resolveSince calcula o timestamp correto para cada janela", () => {
  const now = new Date("2026-08-23T12:00:00.000Z").getTime();
  assert.equal(resolveSince("1h", now), "2026-08-23T11:00:00.000Z");
  assert.equal(resolveSince("24h", now), "2026-08-22T12:00:00.000Z");
  assert.equal(resolveSince("7d", now), "2026-08-16T12:00:00.000Z");
});

test("bucketSamples devolve os pontos sem alteracao quando estao abaixo do alvo", () => {
  const points = [
    { collectedAt: "2026-08-23T10:00:00.000Z", value: 10 },
    { collectedAt: "2026-08-23T10:05:00.000Z", value: 20 }
  ];
  assert.deepEqual(bucketSamples(points, 200), points);
});

test("bucketSamples agrupa em blocos e calcula a media quando excede o alvo", () => {
  const points = Array.from({ length: 10 }, (_, index) => ({
    collectedAt: `2026-08-23T10:${String(index).padStart(2, "0")}:00.000Z`,
    value: index % 2 === 0 ? 10 : 20
  }));

  const bucketed = bucketSamples(points, 5);
  assert.equal(bucketed.length, 5);
  assert.equal(bucketed[0].value, 15);
  assert.equal(bucketed[0].collectedAt, points[1].collectedAt);
  assert.equal(bucketed[bucketed.length - 1].collectedAt, points[points.length - 1].collectedAt);
});

test("summarize retorna null para lista vazia, nunca inventa um valor", () => {
  assert.equal(summarize([]), null);
});

test("summarize calcula current/average/min/max/samples/lastCollectedAt a partir do conjunto completo", () => {
  const points = [
    { collectedAt: "2026-08-23T10:00:00.000Z", value: 10 },
    { collectedAt: "2026-08-23T10:05:00.000Z", value: 30 },
    { collectedAt: "2026-08-23T10:10:00.000Z", value: 20 }
  ];
  const summary = summarize(points);
  assert.equal(summary.current, 20);
  assert.equal(summary.average, 20);
  assert.equal(summary.min, 10);
  assert.equal(summary.max, 30);
  assert.equal(summary.samples, 3);
  assert.equal(summary.lastCollectedAt, "2026-08-23T10:10:00.000Z");
});
