import { zabbixAlerts, zabbixHosts } from "../data/mockZabbix.js";

export async function getHosts() {
  return zabbixHosts;
}

export async function getHostById(id) {
  return zabbixHosts.find((host) => host.id === id) || null;
}

export async function getActiveAlerts() {
  return zabbixAlerts.filter((alert) => alert.status === "active");
}

export async function getAlertHistory() {
  return zabbixAlerts;
}

export async function getHostAlerts(hostId) {
  return zabbixAlerts.filter((alert) => alert.hostId === hostId);
}

