import { AlertTriangle, Clock3, TrendingUp, Users, WifiOff } from "lucide-react";
import DashboardRankingList from "../DashboardRankingList.jsx";

export default function DashboardRankingsSection({
  slices,
  period,
  pending,
  onNavigateInventory,
  onNavigateAlerts,
  onNavigateServiceOrders
}) {
  const { mostProblematic, notSeenRecently, topRecurringAssets, oldestOpen, byTechnician } = slices;
  return (
    <>
      <h2 className="dashboard-section-title">Rankings operacionais</h2>
      <section className="dashboard-ranking-grid">
        <DashboardRankingList
          title="Máquinas mais problemáticas"
          icon={AlertTriangle}
          items={mostProblematic}
          loading={pending}
          emptyMessage="Nenhuma máquina com alertas ativos."
          onSelectItem={onNavigateInventory}
          renderItem={(item) => (
            <>
              <strong>{item.name}</strong>
              <span>
                {item.occurrences} ocorrência(s) em {item.alertCount} alerta(s)
              </span>
            </>
          )}
        />
        <DashboardRankingList
          title="Máquinas sem contato recente"
          icon={WifiOff}
          items={notSeenRecently}
          loading={pending}
          emptyMessage="Todas as máquinas monitoradas estão online."
          onSelectItem={onNavigateInventory}
          renderItem={(item) => (
            <>
              <strong>{item.name}</strong>
              <span>
                {item.statusLabel} - {item.segmentName || "Sem segmento"}
              </span>
            </>
          )}
        />
        <DashboardRankingList
          title="Alertas mais recorrentes"
          icon={TrendingUp}
          items={topRecurringAssets}
          loading={pending}
          emptyMessage={`Nenhuma recorrência registrada nos últimos ${period}.`}
          onSelectItem={onNavigateAlerts}
          renderItem={(item) => (
            <>
              <strong>{item.name}</strong>
              <span>{item.occurrences} ocorrência(s)</span>
            </>
          )}
        />
        <DashboardRankingList
          title="OS abertas mais antigas"
          icon={Clock3}
          items={oldestOpen}
          loading={pending}
          emptyMessage="Nenhuma OS em aberto."
          onSelectItem={onNavigateServiceOrders}
          renderItem={(item) => (
            <>
              <strong>
                {item.number} - {item.title}
              </strong>
              <span>Aberta desde {new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
            </>
          )}
        />
        <DashboardRankingList
          title="Técnicos com mais OS resolvidas"
          icon={Users}
          items={byTechnician}
          loading={pending}
          emptyMessage="Nenhuma OS finalizada com técnico atribuído ainda."
          renderItem={(item) => (
            <>
              <strong>{item.label}</strong>
              <span>{item.count} OS finalizada(s)</span>
            </>
          )}
        />
      </section>
    </>
  );
}
