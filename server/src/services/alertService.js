import { addLog } from "../repositories/logRepository.js";
import {
  attachAcknowledgements,
  deleteAcknowledgement,
  findAcknowledgement,
  listAcknowledgements,
  upsertAcknowledgement
} from "../repositories/alertAcknowledgementRepository.js";
import { getActiveAlerts, getAlertHistory, getHostAlerts } from "./zabbixService.js";

export async function getActiveAlertsWithAcknowledgements() {
  const [alerts, acknowledgements] = await Promise.all([getActiveAlerts(), listAcknowledgements()]);
  return attachAcknowledgements(alerts, acknowledgements);
}

export async function getAlertHistoryWithAcknowledgements() {
  const [alerts, acknowledgements] = await Promise.all([getAlertHistory(), listAcknowledgements()]);
  return attachAcknowledgements(alerts, acknowledgements);
}

export async function getHostAlertsWithAcknowledgements(hostId) {
  const [alerts, acknowledgements] = await Promise.all([getHostAlerts(hostId), listAcknowledgements()]);
  return attachAcknowledgements(alerts, acknowledgements);
}

export async function acknowledgeAlert({ alertId, user, note }) {
  const alerts = await getAlertHistory();
  const alert = alerts.find((item) => item.id === alertId);

  if (!alert) {
    const error = new Error("Alert not found");
    error.statusCode = 404;
    throw error;
  }

  const acknowledgement = await upsertAcknowledgement({ alertId, userId: user.id, note });

  await addLog({
    type: "alert_acknowledgement",
    message: `Alert acknowledged: ${alert.title}`,
    userId: user.id,
    meta: { alertId, hostId: alert.hostId, note: note || null }
  });

  return { ...alert, acknowledgement };
}

export async function unacknowledgeAlert({ alertId, user }) {
  const acknowledgement = await findAcknowledgement(alertId);

  if (!acknowledgement) {
    const error = new Error("Alert acknowledgement not found");
    error.statusCode = 404;
    throw error;
  }

  await deleteAcknowledgement(alertId);

  await addLog({
    type: "alert_unacknowledgement",
    message: "Alert acknowledgement removed",
    userId: user.id,
    meta: { alertId }
  });

  return { alertId };
}
