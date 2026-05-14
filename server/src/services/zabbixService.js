import { zabbixService } from "../integrations/zabbix/ZabbixService.js";

export async function getHosts() {
  return zabbixService.getHosts();
}

export async function getHostById(id) {
  return zabbixService.getHostById(id);
}

export async function getActiveAlerts() {
  const alerts = await zabbixService.getAlerts();
  return alerts.filter((alert) => alert.status === "active");
}

export async function getAlertHistory() {
  return zabbixService.getAlerts();
}

export async function getHostAlerts(hostId) {
  const alerts = await zabbixService.getAlerts();
  return alerts.filter((alert) => alert.hostId === hostId);
}
