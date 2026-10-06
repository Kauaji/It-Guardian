import { monitorEventLoopDelay } from "node:perf_hooks";

// Registro minimo de metricas no formato de exposicao do Prometheus. Sem
// dependencia externa: contadores, histogramas e gauges calculados na hora.

const LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/** @typedef {Record<string, string | number | boolean>} Labels */

/** @param {Labels} labels */
function labelKey(labels) {
  return Object.keys(labels)
    .sort()
    .map((key) => `${key}="${String(labels[key]).replace(/[\\"\n]/g, "_")}"`)
    .join(",");
}

class Counter {
  /**
   * @param {string} name
   * @param {string} help
   */
  constructor(name, help) {
    this.name = name;
    this.help = help;
    /** @type {Map<string, number>} */
    this.values = new Map();
  }
  /**
   * @param {Labels} [labels]
   * @param {number} [amount]
   */
  inc(labels = {}, amount = 1) {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) || 0) + amount);
  }
  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const [key, value] of this.values) lines.push(`${this.name}${key ? `{${key}}` : ""} ${value}`);
    return lines.join("\n");
  }
}

class Histogram {
  /**
   * @param {string} name
   * @param {string} help
   * @param {number[]} [buckets]
   */
  constructor(name, help, buckets = LATENCY_BUCKETS) {
    this.name = name;
    this.help = help;
    this.buckets = buckets;
    /** @type {Map<string, { counts: number[], sum: number, count: number }>} */
    this.series = new Map();
  }
  /**
   * @param {Labels} labels
   * @param {number} seconds
   */
  observe(labels, seconds) {
    const key = labelKey(labels);
    let entry = this.series.get(key);
    if (!entry) {
      entry = { counts: new Array(this.buckets.length).fill(0), sum: 0, count: 0 };
      this.series.set(key, entry);
    }
    this.buckets.forEach((limit, index) => {
      if (seconds <= limit) entry.counts[index] += 1;
    });
    entry.sum += seconds;
    entry.count += 1;
  }
  render() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const [key, entry] of this.series) {
      const prefix = key ? `${key},` : "";
      this.buckets.forEach((limit, index) => {
        lines.push(`${this.name}_bucket{${prefix}le="${limit}"} ${entry.counts[index]}`);
      });
      lines.push(`${this.name}_bucket{${prefix}le="+Inf"} ${entry.count}`);
      lines.push(`${this.name}_sum${key ? `{${key}}` : ""} ${entry.sum}`);
      lines.push(`${this.name}_count${key ? `{${key}}` : ""} ${entry.count}`);
    }
    return lines.join("\n");
  }
}

/** @typedef {number | Record<string, number>} GaugeReading */
/** @typedef {{ name: string, help: string, read: () => GaugeReading, labelName: string | null }} GaugeProvider */

/** @type {Array<Counter | Histogram>} */
const collectors = [];
/** @type {GaugeProvider[]} */
const gaugeProviders = [];

/**
 * @param {string} name
 * @param {string} help
 */
export function counter(name, help) {
  const metric = new Counter(name, help);
  collectors.push(metric);
  return metric;
}

/**
 * @param {string} name
 * @param {string} help
 * @param {number[]} [buckets]
 */
export function histogram(name, help, buckets) {
  const metric = new Histogram(name, help, buckets);
  collectors.push(metric);
  return metric;
}

/**
 * `read` devolve um numero ou um objeto { labelValue: numero } para varias series.
 *
 * @param {string} name
 * @param {string} help
 * @param {() => GaugeReading} read
 * @param {string | null} [labelName]
 */
export function gauge(name, help, read, labelName = null) {
  gaugeProviders.push({ name, help, read, labelName });
}

export const httpRequests = counter("itguardian_http_requests_total", "Requisicoes HTTP por metodo, rota e status.");
export const httpDuration = histogram("itguardian_http_request_duration_seconds", "Duracao das requisicoes HTTP.");
export const authEvents = counter("itguardian_auth_events_total", "Eventos de autenticacao (login, falha, bloqueio, MFA).");
export const rateLimited = counter("itguardian_rate_limit_rejections_total", "Requisicoes recusadas por limite de taxa.");
export const rateLimitStoreErrors = counter(
  "itguardian_rate_limit_store_errors_total",
  "Falhas do armazenamento do limitador (liberou a requisicao)."
);
export const appErrors = counter("itguardian_errors_total", "Erros de aplicacao por classe de status.");

const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();

gauge("itguardian_process_uptime_seconds", "Tempo de atividade do processo.", () => process.uptime());
gauge("itguardian_process_resident_memory_bytes", "Memoria residente.", () => process.memoryUsage().rss);
gauge("itguardian_nodejs_heap_used_bytes", "Heap usado.", () => process.memoryUsage().heapUsed);
gauge("itguardian_nodejs_eventloop_lag_p99_seconds", "Atraso p99 do event loop.", () => loopDelay.percentile(99) / 1e9);

/** @param {GaugeProvider} provider */
function renderGauge({ name, help, read, labelName }) {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} gauge`];
  /** @type {GaugeReading} */
  let value;
  try {
    value = read();
  } catch {
    return lines.join("\n");
  }
  if (typeof value === "number") lines.push(`${name} ${value}`);
  else for (const [label, item] of Object.entries(value || {})) lines.push(`${name}{${labelName}="${label}"} ${item}`);
  return lines.join("\n");
}

export function renderMetrics() {
  return `${[...collectors.map((metric) => metric.render()), ...gaugeProviders.map(renderGauge)].join("\n")}\n`;
}
