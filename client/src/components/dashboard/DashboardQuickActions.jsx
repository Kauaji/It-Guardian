import { AlertTriangle, ClipboardPlus, Server, Settings } from "lucide-react";

export default function DashboardQuickActions({
  onNavigateInventory,
  onNavigateAlerts,
  onNavigateServiceOrders,
  onOpenSettings
}) {
  const actions = [
    {
      key: "new-service-order",
      label: "Nova Ordem de Serviço",
      icon: ClipboardPlus,
      onClick: onNavigateServiceOrders
    },
    { key: "inventory", label: "Ver Inventário", icon: Server, onClick: onNavigateInventory },
    { key: "alerts", label: "Ver Avisos", icon: AlertTriangle, onClick: onNavigateAlerts },
    { key: "settings", label: "Configurações gerais", icon: Settings, onClick: onOpenSettings }
  ].filter((action) => typeof action.onClick === "function");

  if (!actions.length) return null;

  return (
    <section className="dashboard-quick-actions" aria-label="Ações rápidas">
      {actions.map(({ key, label, icon: Icon, onClick }) => (
        <button key={key} type="button" className="dashboard-quick-action" onClick={onClick}>
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </section>
  );
}
