import { zabbixAlerts, zabbixHosts } from "../../data/mockZabbix.js";
import {
  ExternalIntegrationError,
  requestJson
} from "../httpJsonClient.js";

export class ZabbixService {
  constructor({
    mode = process.env.ZABBIX_MODE || "mock",
    enabled,
    apiUrl = process.env.ZABBIX_API_URL || "",
    token = process.env.ZABBIX_API_TOKEN || "",
    timeoutMs = Number(process.env.ZABBIX_TIMEOUT_MS || 10000),
    retries = Number(process.env.ZABBIX_RETRIES || 1),
    fetchImpl = globalThis.fetch
  } = {}) {
    this.mode = ["mock", "real", "disabled"].includes(mode) ? mode : "disabled";
    this.enabled = enabled ?? (
      this.mode === "mock" ||
      (this.mode === "real" && String(process.env.ZABBIX_ENABLED || "").toLowerCase() === "true")
    );
    this.apiUrl = apiUrl.replace(/\/+$/, "");
    this.token = token;
    this.timeoutMs = Math.max(250, timeoutMs);
    this.retries = Math.max(0, retries);
    this.fetchImpl = fetchImpl;
    this.requestId = 0;
  }

  getConfiguration() {
    return {
      source: "zabbix",
      mode: this.mode,
      enabled: Boolean(this.enabled),
      baseUrl: this.apiUrl || null,
      configured: this.mode === "mock" || Boolean(this.apiUrl && this.token)
    };
  }

  async getHosts() {
    if (!this.enabled || this.mode === "disabled") return [];
    if (this.mode === "real") {
      return this.getHostsFromApi();
    }

    return zabbixHosts;
  }

  async getHostById(id) {
    const hosts = await this.getHosts();
    return hosts.find((host) => host.id === id) || null;
  }

  async getAlerts() {
    if (!this.enabled || this.mode === "disabled") return [];
    if (this.mode === "real") {
      return this.getAlertsFromApi();
    }

    return zabbixAlerts;
  }

  async rpc(method, params = {}) {
    if (!this.apiUrl || !this.token) {
      throw new ExternalIntegrationError(
        "Zabbix",
        "A integracao Zabbix nao esta completamente configurada."
      );
    }
    const payload = await requestJson({
      source: "Zabbix",
      url: this.apiUrl,
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json-rpc"
      },
      body: {
        jsonrpc: "2.0",
        method,
        params,
        id: ++this.requestId
      },
      timeoutMs: this.timeoutMs,
      retries: this.retries,
      fetchImpl: this.fetchImpl
    });
    if (payload?.error || !Array.isArray(payload?.result)) {
      throw new ExternalIntegrationError(
        "Zabbix",
        "A integracao Zabbix recusou a consulta. Verifique token e permissoes."
      );
    }
    return payload.result;
  }

  async getHostsFromApi() {
    const hosts = await this.rpc("host.get", {
      output: ["hostid", "host", "name", "status", "description"],
      selectInterfaces: ["ip", "dns", "main", "available"],
      selectInventory: [
        "asset_tag",
        "serialno_a",
        "serialno_b",
        "macaddress_a",
        "macaddress_b",
        "vendor",
        "model",
        "os",
        "os_full",
        "notes"
      ],
      monitored_hosts: true
    });
    return hosts.map((host) => ({
      ...host,
      id: host.hostid,
      name: host.name || host.host,
      ip: host.interfaces?.find((item) => item.main === "1")?.ip || host.interfaces?.[0]?.ip || null,
      status: host.interfaces?.some((item) => item.available === "2")
        ? "problem"
        : host.status === "1"
          ? "offline"
          : "online",
      metrics: {},
      history: [],
      collectedAt: new Date().toISOString()
    }));
  }

  async getAlertsFromApi() {
    const problems = await this.rpc("problem.get", {
      output: ["eventid", "objectid", "clock", "r_clock", "name", "severity"],
      selectTags: "extend",
      recent: true,
      sortfield: ["eventid"],
      sortorder: "DESC",
      limit: 500
    });
    const triggerIds = Array.from(
      new Set(problems.map((problem) => problem.objectid).filter(Boolean))
    );
    if (!triggerIds.length) return problems;

    const triggers = await this.rpc("trigger.get", {
      triggerids: triggerIds,
      output: ["triggerid"],
      selectHosts: ["hostid", "host", "name"]
    });
    const hostsByTrigger = new Map(
      triggers.map((trigger) => [String(trigger.triggerid), trigger.hosts?.[0] || null])
    );
    return problems.map((problem) => {
      const host = hostsByTrigger.get(String(problem.objectid));
      return {
        ...problem,
        hostid: host?.hostid || null,
        hostname: host?.host || host?.name || null
      };
    });
  }

  async testConnection() {
    if (!this.enabled || this.mode === "disabled") {
      return { ok: true, skipped: true, mode: this.mode };
    }
    if (this.mode === "mock") {
      return { ok: true, skipped: false, mode: this.mode, discoveredHosts: zabbixHosts.length };
    }
    const hosts = await this.getHostsFromApi();
    return { ok: true, skipped: false, mode: this.mode, discoveredHosts: hosts.length };
  }
}

export const zabbixService = new ZabbixService();
