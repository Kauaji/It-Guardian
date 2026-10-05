import { matchPath } from "react-router-dom";
import { ACCOUNT_SECURITY_LABEL, ACCOUNT_SECURITY_PATH, ACCOUNT_VIEW_ID } from "../auth/accountRoutes.js";

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

// Rotas da conta (ex.: /conta/seguranca): sempre permitidas para quem esta
// logado, por isso ficam fora de `viewRoutes` (que depende de permissao).
export { ACCOUNT_SECURITY_PATH, ACCOUNT_VIEW_ID };

export function viewIdFromPath(pathname) {
  if (matchPath({ path: ACCOUNT_SECURITY_PATH, end: true }, pathname)) return ACCOUNT_VIEW_ID;
  const route = viewRoutes.find((item) =>
    item.paths.some((path) => matchPath({ path, end: true }, pathname))
  );
  return route ? route.id : null;
}

export function pathForView(viewId) {
  if (viewId === ACCOUNT_VIEW_ID) return ACCOUNT_SECURITY_PATH;
  const route = viewRoutes.find((item) => item.id === viewId);
  return route ? route.paths[0] : viewRoutes[0].paths[0];
}

export function labelForView(viewId) {
  if (viewId === ACCOUNT_VIEW_ID) return ACCOUNT_SECURITY_LABEL;
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
