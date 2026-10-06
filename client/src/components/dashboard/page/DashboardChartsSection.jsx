import { AlertTriangle, ClipboardList, Server, TrendingUp } from "lucide-react";
import DashboardChartCard from "../DashboardChartCard.jsx";
import { SimpleBarChart, SimpleTrendChart } from "./dashboardCharts.jsx";

export default function DashboardChartsSection({ slices, period, pending }) {
  const { byStatus, bySeverity, soByStatus, soByPriority, soTrend, alertsTrend } = slices;
  return (
    <>
      <h2 className="dashboard-section-title">Distribuição e tendências</h2>
      <section className="dashboard-chart-grid">
        <DashboardChartCard title="Ativos por status" icon={Server} loading={pending} empty={!byStatus.length}>
          <SimpleBarChart data={byStatus} color="#2563eb" />
        </DashboardChartCard>
        <DashboardChartCard
          title="Alertas por severidade"
          icon={AlertTriangle}
          loading={pending}
          empty={!bySeverity.length}
          emptyMessage="Nenhum alerta ativo no momento."
        >
          <SimpleBarChart data={bySeverity} color="#d64545" />
        </DashboardChartCard>
        <DashboardChartCard
          title="OS por status"
          icon={ClipboardList}
          loading={pending}
          empty={!soByStatus.length}
          emptyMessage="Nenhuma ordem de serviço cadastrada."
        >
          <SimpleBarChart data={soByStatus} color="#16a34a" />
        </DashboardChartCard>
        <DashboardChartCard
          title="OS por prioridade"
          icon={ClipboardList}
          loading={pending}
          empty={!soByPriority.length}
          emptyMessage="Nenhuma ordem de serviço cadastrada."
        >
          <SimpleBarChart data={soByPriority} color="#d97706" />
        </DashboardChartCard>
        <DashboardChartCard
          title={`Tendência de OS abertas (${period})`}
          icon={TrendingUp}
          loading={pending}
          empty={!soTrend.some((item) => item.count > 0)}
          emptyMessage="Nenhuma OS criada neste período."
        >
          <SimpleTrendChart data={soTrend} color="#2563eb" />
        </DashboardChartCard>
        <DashboardChartCard
          title={`Tendência de alertas (${period})`}
          icon={TrendingUp}
          loading={pending}
          empty={!alertsTrend.some((item) => item.count > 0)}
          emptyMessage="Nenhum alerta registrado neste período."
        >
          <SimpleTrendChart data={alertsTrend} color="#d64545" />
        </DashboardChartCard>
      </section>
    </>
  );
}
