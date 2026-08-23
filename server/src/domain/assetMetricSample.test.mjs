import assert from "node:assert/strict";
import test from "node:test";

import { deriveMetricSampleFields, hasUsefulMetricPayload } from "./assetMetricSample.js";

test("deriveMetricSampleFields calcula RAM/disco em % igual a monitoringService.js's buildAgentDevice", () => {
  const fields = deriveMetricSampleFields({
    cpuUsagePercent: 42,
    memoryTotalBytes: 10_000,
    memoryUsedBytes: 4_000,
    diskTotalBytes: 100_000,
    diskFreeBytes: 60_000
  });

  assert.equal(fields.cpuUsagePercent, 42);
  assert.equal(fields.memoryUsagePercent, 40);
  assert.equal(fields.diskUsedBytes, 40_000);
  assert.equal(fields.diskUsagePercent, 40);
});

test("deriveMetricSampleFields nunca inventa 0 quando o total esta ausente ou zerado", () => {
  const fields = deriveMetricSampleFields({
    cpuUsagePercent: null,
    memoryTotalBytes: 0,
    memoryUsedBytes: 500,
    diskTotalBytes: null,
    diskFreeBytes: 100
  });

  assert.equal(fields.cpuUsagePercent, null);
  assert.equal(fields.memoryUsagePercent, null);
  assert.equal(fields.diskUsagePercent, null);
  assert.equal(fields.diskUsedBytes, null);
});

test("deriveMetricSampleFields nunca grava percentual fora de 0-100", () => {
  const fields = deriveMetricSampleFields({
    cpuUsagePercent: 150,
    memoryTotalBytes: 1000,
    memoryUsedBytes: 5000,
    diskTotalBytes: 1000,
    diskFreeBytes: -500
  });

  assert.equal(fields.cpuUsagePercent, 100);
  assert.equal(fields.memoryUsagePercent, 100);
  assert.equal(fields.diskUsagePercent, 100);
});

test("hasUsefulMetricPayload exige pelo menos uma familia de metrica presente", () => {
  assert.equal(hasUsefulMetricPayload({ cpuUsagePercent: 10 }), true);
  assert.equal(hasUsefulMetricPayload({ memoryTotalBytes: 1000 }), true);
  assert.equal(hasUsefulMetricPayload({ diskTotalBytes: 1000 }), true);
  assert.equal(hasUsefulMetricPayload({}), false);
  assert.equal(hasUsefulMetricPayload({ hostname: "PC-01" }), false);
});
