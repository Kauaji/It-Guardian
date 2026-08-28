import {
  getDashboardLayoutForUser,
  resetDashboardLayoutForUser,
  saveDashboardLayoutForUser
} from "../services/dashboardLayoutService.js";
import { listWidgetCatalog, previewWidget } from "../services/dashboardWidgetService.js";

export async function getLayout(req, res, next) {
  try {
    const layout = await getDashboardLayoutForUser(req.user.id);
    res.json(layout);
  } catch (error) {
    next(error);
  }
}

export async function saveLayout(req, res, next) {
  try {
    const layout = await saveDashboardLayoutForUser(req.user.id, req.body);
    res.json(layout);
  } catch (error) {
    next(error);
  }
}

export async function resetLayout(req, res, next) {
  try {
    const layout = await resetDashboardLayoutForUser(req.user.id);
    res.json(layout);
  } catch (error) {
    next(error);
  }
}

export async function getWidgetCatalog(req, res, next) {
  try {
    res.json({ widgets: listWidgetCatalog() });
  } catch (error) {
    next(error);
  }
}

export async function previewWidgetData(req, res, next) {
  try {
    const result = await previewWidget({
      type: req.body?.type,
      config: req.body?.config,
      filters: req.body?.filters,
      user: req.user
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
