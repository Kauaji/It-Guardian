import { validateDashboardLayout } from "../domain/dashboardLayoutValidation.js";
import { deleteUserPreference, findUserPreference, upsertUserPreference } from "../repositories/userPreferenceRepository.js";
import { getDefaultDashboardLayout } from "./dashboardWidgets/defaultLayout.js";
import { knownWidgetTypes } from "./dashboardWidgets/widgetRegistry.js";

// Guarda a preferencia na tabela generica user_preferences (reaproveitada,
// sem migration nova) sob uma chave propria -- deliberadamente NAO exposta
// pela rota generica /api/preferences/:key (que so exige login, sem a
// permissao dashboard.customize e sem a validacao de forma abaixo). So as
// rotas dedicadas de /api/dashboard/layout leem/escrevem esta chave.
const PREFERENCE_KEY = "dashboard-layout";

export async function getDashboardLayoutForUser(userId) {
  const preference = await findUserPreference(userId, PREFERENCE_KEY);
  if (preference?.value?.widgets) return preference.value;
  return getDefaultDashboardLayout();
}

export async function saveDashboardLayoutForUser(userId, layout) {
  validateDashboardLayout(layout, { knownWidgetTypes });
  const preference = await upsertUserPreference(userId, PREFERENCE_KEY, layout);
  return preference.value;
}

export async function resetDashboardLayoutForUser(userId) {
  await deleteUserPreference(userId, PREFERENCE_KEY);
  return getDefaultDashboardLayout();
}
