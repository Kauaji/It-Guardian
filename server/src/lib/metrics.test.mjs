import assert from "node:assert/strict";
import test from "node:test";
import { counter, histogram, renderMetrics } from "./metrics.js";

test("contador e histograma saem no formato do Prometheus", () => {
  const hits = counter("teste_hits_total", "Contador de teste.");
  hits.inc({ rota: "/a" });
  hits.inc({ rota: "/a" }, 2);
  const latency = histogram("teste_latencia_seconds", "Histograma de teste.", [0.1, 1]);
  latency.observe({ rota: "/a" }, 0.05);
  latency.observe({ rota: "/a" }, 0.5);

  const text = renderMetrics();
  assert.match(text, /# TYPE teste_hits_total counter/);
  assert.match(text, /teste_hits_total\{rota="\/a"\} 3/);
  assert.match(text, /teste_latencia_seconds_bucket\{rota="\/a",le="0.1"\} 1/);
  assert.match(text, /teste_latencia_seconds_bucket\{rota="\/a",le="1"\} 2/);
  assert.match(text, /teste_latencia_seconds_bucket\{rota="\/a",le="\+Inf"\} 2/);
  assert.match(text, /teste_latencia_seconds_count\{rota="\/a"\} 2/);
});

test("expoe metricas padrao do processo", () => {
  const text = renderMetrics();
  for (const name of ["itguardian_process_uptime_seconds", "itguardian_process_resident_memory_bytes", "itguardian_nodejs_eventloop_lag_p99_seconds"]) {
    assert.match(text, new RegExp(`^${name} `, "m"));
  }
});
