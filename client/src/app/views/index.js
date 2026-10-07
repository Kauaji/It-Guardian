import AlertsView from "./AlertsView.jsx";
import CalendarView from "./CalendarView.jsx";
import DashboardView from "./DashboardView.jsx";
import InventoryView from "./InventoryView.jsx";
import PartsInventoryView from "./PartsInventoryView.jsx";
import ServiceOrdersView from "./ServiceOrdersView.jsx";

// Visao (componente) de cada id da tabela de rotas (../routes.js).
export const viewComponents = {
  dashboard: DashboardView,
  alerts: AlertsView,
  "service-orders": ServiceOrdersView,
  calendar: CalendarView,
  "parts-inventory": PartsInventoryView,
  inventory: InventoryView
};
