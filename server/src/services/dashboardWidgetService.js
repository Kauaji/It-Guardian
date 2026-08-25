import { badRequest } from "../lib/errors.js";
import { createWidgetContext } from "./dashboardWidgets/widgetContext.js";
import { getWidgetCatalog, knownWidgetTypes, widgetRegistry } from "./dashboardWidgets/widgetRegistry.js";

export function listWidgetCatalog() {
  return getWidgetCatalog();
}

export async function previewWidget({ type, config, user }) {
  if (typeof type !== "string" || !knownWidgetTypes.has(type)) {
    throw badRequest("Tipo de widget desconhecido.");
  }

  const entry = widgetRegistry[type];
  if (entry.validateConfig) {
    const validationError = entry.validateConfig(config);
    if (validationError) throw badRequest(`Widget invalido: ${validationError}`);
  }

  const ctx = createWidgetContext({ user });
  const data = await entry.fetchData(config || {}, ctx);
  return { type, data };
}
