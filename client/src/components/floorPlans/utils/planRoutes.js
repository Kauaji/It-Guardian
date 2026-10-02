const PLAN_ROUTE_PATTERN = /^\/plantas\/([^/]+)(\/editor)?$/;

export const PLANS_LIST_PATH = "/plantas";

/** Le `/plantas/:id` ou `/plantas/:id/editor`; retorna null para outros caminhos. */
export function parsePlanRoute(pathname) {
  const match = String(pathname || "").match(PLAN_ROUTE_PATTERN);
  return match ? { planId: match[1], editing: Boolean(match[2]) } : null;
}

/** Caminho da planta aberta (modo edicao ou visualizacao). */
export function buildPlanPath(planId, editing) {
  return editing ? `/plantas/${planId}/editor` : `/plantas/${planId}`;
}

/** Decide qual planta abrir: a da URL, se existir na lista, ou a primeira. */
export function resolvePlanToOpen(plans, pathname) {
  const route = parsePlanRoute(pathname);
  const routePlan = route && plans.find((plan) => plan.id === route.planId);
  return {
    planId: routePlan?.id || plans[0].id,
    editing: Boolean(routePlan && route.editing)
  };
}
