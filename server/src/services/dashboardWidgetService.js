import { badRequest } from "../lib/errors.js";
import { createWidgetContext } from "./dashboardWidgets/widgetContext.js";
import { normalizeDashboardFilters } from "./dashboardWidgets/widgetFilters.js";
import { getWidgetCatalog, knownWidgetTypes, widgetRegistry } from "./dashboardWidgets/widgetRegistry.js";

export function listWidgetCatalog() {
  return getWidgetCatalog();
}

export async function previewWidget({ type, config, filters, user }) {
  if (typeof type !== "string" || !knownWidgetTypes.has(type)) {
    throw badRequest("Tipo de widget desconhecido.");
  }

  const entry = widgetRegistry[type];
  const selections = normalizeDashboardFilters(filters);
  const previewConfig = entry.requiresAssetConfig && selections.assetId
    ? { ...config, assetId: selections.assetId }
    : config;
  if (entry.validateConfig) {
    const validationError = entry.validateConfig(previewConfig);
    if (validationError) throw badRequest(`Widget invalido: ${validationError}`);
  }

  const ctx = createWidgetContext({ user, filters: selections });
  await ctx.validateFilters();
  const data = await entry.fetchData(previewConfig || {}, ctx);
  return { type, data };
}
