import {
  acknowledgeAlert,
  addCommentToAlert,
  acceptServiceOrderSuggestion,
  evaluateAlertsForSuggestions,
  getActiveAlertsWithAcknowledgements,
  getAlertCorrelations,
  getAlertInsights,
  getAlertSettingsData,
  getAlertHistoryWithAcknowledgements,
  getAlertRules,
  listCommentsForAlert,
  listServiceOrderSuggestions,
  rejectServiceOrderSuggestion,
  updateAlertSettingsData,
  updateAlertRuleById,
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

export async function rules(req, res, next) {
  try {
    res.json({ rules: await getAlertRules() });
  } catch (error) {
    next(error);
  }
}

export async function settings(req, res, next) {
  try {
    res.json({ settings: await getAlertSettingsData() });
  } catch (error) {
    next(error);
  }
}

export async function correlations(req, res, next) {
  try {
    res.json({ correlations: await getAlertCorrelations() });
  } catch (error) {
    next(error);
  }
}

export async function insights(req, res, next) {
  try {
    res.json({ insights: await getAlertInsights() });
  } catch (error) {
    next(error);
  }
}

export async function comments(req, res, next) {
  try {
    res.json({ comments: await listCommentsForAlert(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function addComment(req, res, next) {
  try {
    const comment = await addCommentToAlert({
      alertId: req.params.id,
      message: req.body?.message,
      user: req.user
    });

    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const settings = await updateAlertSettingsData({
      payload: req.body || {},
      user: req.user
    });
    res.json({ settings });
  } catch (error) {
    next(error);
  }
}

export async function updateRule(req, res, next) {
  try {
    const rule = await updateAlertRuleById({
      id: req.params.id,
      payload: req.body || {},
      user: req.user
    });
    res.json({ rule });
  } catch (error) {
    next(error);
  }
}

export async function evaluate(req, res, next) {
  try {
    const result = await evaluateAlertsForSuggestions(req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function suggestions(req, res, next) {
  try {
    res.json({ suggestions: await listServiceOrderSuggestions() });
  } catch (error) {
    next(error);
  }
}

export async function acceptSuggestion(req, res, next) {
  try {
    const result = await acceptServiceOrderSuggestion({
      id: req.params.id,
      user: req.user
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after alert suggestion acceptance", error);
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function rejectSuggestion(req, res, next) {
  try {
    const suggestion = await rejectServiceOrderSuggestion({
      id: req.params.id,
      reason: req.body?.reason,
      user: req.user
    });

    res.json({ suggestion });
  } catch (error) {
    next(error);
  }
}
