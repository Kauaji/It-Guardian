import { matchPath } from "react-router-dom";

// Tabela unica das visoes de nivel superior do app autenticado. O `id` e o
// mesmo identificador usado internamente (useDashboardData, ViewErrorBoundary)
// e `paths` lista as URLs que abrem a visao; a primeira e a canonica. Modais
// nao possuem rota. `/plantas/*` continua valido porque o modulo de plantas
// (components/floorPlans) gerencia /plantas/:id e /plantas/:id/editor sozinho.
export const LOGIN_PATH = "/login";
export const DEFAULT_VIEW_ID = "dashboard";
export const BLOCKED_VIEW_ID = "blocked";

export const viewRoutes = [
  { id: "dashboard", label: "Dashboard", paths: ["/"] },
  { id: "alerts", label: "Avisos", paths: ["/avisos"] },
  { id: "service-orders", label: "Ordens de Serviço", paths: ["/ordens-de-servico"] },
  { id: "calendar", label: "Agenda Técnica", paths: ["/agenda"] },
  { id: "parts-inventory", label: "Inventário de Peças", paths: ["/pecas"] },
  { id: "inventory", label: "Inventário de Ativos", paths: ["/inventario", "/plantas/*"] }
];

export function viewIdFromPath(pathname) {
  const route = viewRoutes.find((item) =>
    item.paths.some((path) => matchPath({ path, end: true }, pathname))
  );
  return route ? route.id : null;
}

export function pathForView(viewId) {
  const route = viewRoutes.find((item) => item.id === viewId);
  return route ? route.paths[0] : viewRoutes[0].paths[0];
}

export function labelForView(viewId) {
  return viewRoutes.find((item) => item.id === viewId)?.label || "";
}

// Destino pos-login: so aceita caminhos internos (evita redirecionar para
// fora do app) e nunca volta para a propria tela de login.
export function resolveLoginDestination(from) {
  const pathname = typeof from?.pathname === "string" ? from.pathname : "";
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname === LOGIN_PATH) {
    return "/";
  }
  return `${pathname}${from.search || ""}${from.hash || ""}`;
}
