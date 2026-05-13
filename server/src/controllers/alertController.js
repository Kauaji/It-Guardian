import {
  acknowledgeAlert,
  getActiveAlertsWithAcknowledgements,
  getAlertHistoryWithAcknowledgements,
  unacknowledgeAlert
} from "../services/alertService.js";
import { broadcastSnapshot } from "../services/realtimeService.js";

export async function active(req, res, next) {
  try {
    const alerts = await getActiveAlertsWithAcknowledgements();
    res.json({ alerts });
  } catch (error) {
    next(error);
  }
}

export async function history(req, res, next) {
  try {
    const alerts = await getAlertHistoryWithAcknowledgements();
    res.json({ alerts });
  } catch (error) {
    next(error);
  }
}

export async function acknowledge(req, res, next) {
  try {
    const alert = await acknowledgeAlert({
      alertId: req.params.id,
      user: req.user,
      note: req.body.note
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after acknowledgement", error);
    });

    res.json({ alert });
  } catch (error) {
    next(error);
  }
}

export async function removeAcknowledgement(req, res, next) {
  try {
    const result = await unacknowledgeAlert({
      alertId: req.params.id,
      user: req.user
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after acknowledgement removal", error);
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}
