import { zabbixAlerts, zabbixHosts } from "../../data/mockZabbix.js";

export class ZabbixService {
  constructor({ mode = process.env.ZABBIX_MODE || "mock" } = {}) {
    this.mode = mode;
  }

  async getHosts() {
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
    if (this.mode === "real") {
      return this.getAlertsFromApi();
    }

    return zabbixAlerts;
  }

  async getHostsFromApi() {
    const error = new Error("Integracao real com Zabbix deve rodar no backend futuro em VPS.");
    error.statusCode = 501;
    throw error;
  }

  async getAlertsFromApi() {
    const error = new Error("Integracao real com Zabbix deve rodar no backend futuro em VPS.");
    error.statusCode = 501;
    throw error;
  }
}

export const zabbixService = new ZabbixService();
