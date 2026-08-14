import { useMemo } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Network,
  Search,
  Server,
  ShieldCheck,
  TrendingUp,
  Users,
  WifiOff,
  Wrench
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatDisplayText } from "../alerts/alertUtils.js";
import { useDashboardSummary } from "../../hooks/useDashboardSummary.js";
import { useSettledWidthKey } from "../../hooks/useSettledWidthKey.js";
import SummaryCard from "../ui/SummaryCard.jsx";
import AlertList from "./AlertList.jsx";
import DeviceDetails from "./DeviceDetails.jsx";
import DeviceTable from "./DeviceTable.jsx";
import DashboardChartCard from "./DashboardChartCard.jsx";
import DashboardFilters from "./DashboardFilters.jsx";
import DashboardHealthScore from "./DashboardHealthScore.jsx";
import DashboardKpiCard from "./DashboardKpiCard.jsx";
import DashboardQuickActions from "./DashboardQuickActions.jsx";
import DashboardRankingList from "./DashboardRankingList.jsx";
import { metricClass, statusClass } from "./dashboardFormatters.js";
import { buildAlertTrend } from "./dashboardModel.js";

function SimpleBarChart({ data, color = "#2563eb", ...responsiveProps }) {
  return (
    <BarChart data={data} {...responsiveProps}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft, #e2e8f0)" />
      <XAxis dataKey="label" stroke="#69758a" interval={0} angle={-20} textAnchor="end" height={50} />
      <YAxis allowDecimals={false} stroke="#69758a" />
      <Tooltip />
      <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
    </BarChart>
  );
}

function SimpleTrendChart({ data, color = "#2563eb", ...responsiveProps }) {
  return (
    <AreaChart data={data} {...responsiveProps}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft, #e2e8f0)" />
      <XAxis dataKey="date" stroke="#69758a" tickFormatter={(value) => value.slice(5)} />
      <YAxis allowDecimals={false} stroke="#69758a" />
      <Tooltip />
      <Area dataKey="count" stroke={color} fill={color} fillOpacity={0.25} />
    </AreaChart>
  );
}

export default function DashboardPage({
  token,
  notify,
  summary,
  search,
  setSearch,
  status,
  setStatus,
  loading,
  devices,
  selectedId,
  selectedDevice,
  selectDevice,
  alerts,
  history,
  onNavigateInventory,
  onNavigateAlerts,
  onNavigateServiceOrders,
  onOpenSettings
}) {
  const { report, loading: reportLoading, error: reportError, period, setPeriod, reload } =
    useDashboardSummary({ token, canView: true, notify });
  const alertTrend = useMemo(() => buildAlertTrend(history), [history]);
  const settledWidthKey = useSettledWidthKey();

  const overview = report?.overview || null;
  const assets = report?.assets || null;
  const alertsData = report?.alerts || null;
  const serviceOrdersData = report?.serviceOrders || null;
  const business = report?.business || null;
  const reportPending = reportLoading && !report;

  const byStatus = assets?.byStatus || [];
  const bySeverity = alertsData?.bySeverity || [];
  const soByStatus = serviceOrdersData?.byStatus || [];
  const soByPriority = serviceOrdersData?.byPriority || [];
  const soTrend = serviceOrdersData?.trend || [];
  const alertsTrend = alertsData?.trend || [];
  const mostProblematic = assets?.mostProblematic || [];
  const notSeenRecently = assets?.notSeenRecently || [];
  const topRecurringAssets = alertsData?.topRecurringAssets || [];
  const oldestOpen = serviceOrdersData?.oldestOpen || [];
  const byTechnician = serviceOrdersData?.byTechnician || [];
  const byEnvironment = business?.byEnvironment || [];

  return (
    <>
      <DashboardFilters period={period} onChangePeriod={setPeriod} onRefresh={reload} refreshing={reportLoading} />

      <DashboardQuickActions
        onNavigateInventory={onNavigateInventory}
        onNavigateAlerts={onNavigateAlerts}
        onNavigateServiceOrders={onNavigateServiceOrders}
        onOpenSettings={onOpenSettings}
      />

      {reportError && (
        <p className="form-error dashboard-report-error" role="alert">
          {reportError}
          <button type="button" className="secondary-action" onClick={reload}>Tentar novamente</button>
        </p>
      )}

      <section className="dashboard-kpi-grid">
        <DashboardHealthScore health={overview?.infrastructureHealth} loading={reportPending} />
        <DashboardKpiCard
          icon={ClipboardList}
          title="OS abertas"
          value={overview ? overview.openServiceOrders : "--"}
          subtitle="Ordens de servico ainda nao finalizadas"
          loading={reportPending}
        />
        <DashboardKpiCard
          icon={Clock3}
          title="OS vencidas"
          value={overview?.overdueServiceOrdersAvailable ? overview.overdueServiceOrders : "Indisponivel"}
          subtitle="Depende de prazo/SLA persistido (ainda nao implementado)"
          tone={overview?.overdueServiceOrdersAvailable ? "" : "muted"}
          loading={reportPending}
        />
        <DashboardKpiCard
          icon={Wrench}
          title="Em manutencao"
          value={overview ? overview.inMaintenanceAssets : "--"}
          subtitle="Ativos com manutencao ativa no momento"
          loading={reportPending}
        />
        <DashboardKpiCard
          icon={CheckCircle2}
          title="Alertas resolvidos hoje"
          value={overview ? overview.resolvedAlertsToday : "--"}
          subtitle="Contagem do dia corrente"
          tone="ok"
          loading={reportPending}
        />
      </section>

      {summary && (
        <section className="summary-grid">
          <SummaryCard icon={Server} label="Dispositivos" value={summary.totalDevices} />
          <SummaryCard icon={ShieldCheck} label="Online" value={summary.online} tone="ok" />
          <SummaryCard icon={WifiOff} label="Offline" value={summary.offline} tone="warning" />
          <SummaryCard icon={AlertTriangle} label="Erro" value={summary.problem} tone="danger" />
          <SummaryCard icon={AlertTriangle} label="Críticos" value={summary.criticalAlerts} tone="danger" />
        </section>
      )}

      <section className="toolbar">
        <div className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, IP ou status" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos os status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="problem">Erro</option>
        </select>
      </section>

      <section className="content-grid">
        <section className="panel devices-panel">
          <div className="panel-heading">
            <h2>Máquinas monitoradas</h2>
            {loading && <span className="loading">Carregando...</span>}
          </div>
          <DeviceTable
            devices={devices}
            selectedId={selectedId}
            onSelect={selectDevice}
            statusClass={statusClass}
          />
        </section>
        <AlertList alerts={alerts} />
      </section>

      <section className="bottom-grid">
        <DeviceDetails
          device={selectedDevice}
          statusClass={statusClass}
          metricClass={metricClass}
        />
        <section className="panel history-panel">
          <div className="panel-heading">
            <h2>Histórico de avisos</h2>
            <Network size={18} />
          </div>
          <div className="chart-box compact-chart">
            <ResponsiveContainer key={settledWidthKey} width="100%" height={170}>
              <AreaChart data={alertTrend}>
                <XAxis dataKey="label" stroke="#69758a" />
                <YAxis allowDecimals={false} stroke="#69758a" />
                <Tooltip />
                <Area dataKey="critical" stackId="1" stroke="#d64545" fill="#d64545" />
                <Area dataKey="warning" stackId="1" stroke="#d6a21f" fill="#d6a21f" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="history-list">
            {history.map((alert) => (
              <div key={alert.id}>
                <span className={`dot ${alert.severity}`} />
                <strong>{formatDisplayText(alert.hostName || alert.assetName, "Máquina não vinculada")}</strong>
                <span>{formatDisplayText(alert.title, "Aviso")}{alert.acknowledgement ? " - resolvido" : ""}</span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <h2 className="dashboard-section-title">Distribuicao e tendencias</h2>
      <section className="dashboard-chart-grid">
        <DashboardChartCard title="Ativos por status" icon={Server} loading={reportPending} empty={!byStatus.length}>
          <SimpleBarChart data={byStatus} color="#2563eb" />
        </DashboardChartCard>
        <DashboardChartCard
          title="Alertas por severidade"
          icon={AlertTriangle}
          loading={reportPending}
          empty={!bySeverity.length}
          emptyMessage="Nenhum alerta ativo no momento."
        >
          <SimpleBarChart data={bySeverity} color="#d64545" />
        </DashboardChartCard>
        <DashboardChartCard
          title="OS por status"
          icon={ClipboardList}
          loading={reportPending}
          empty={!soByStatus.length}
          emptyMessage="Nenhuma ordem de servico cadastrada."
        >
          <SimpleBarChart data={soByStatus} color="#16a34a" />
        </DashboardChartCard>
        <DashboardChartCard
          title="OS por prioridade"
          icon={ClipboardList}
          loading={reportPending}
          empty={!soByPriority.length}
          emptyMessage="Nenhuma ordem de servico cadastrada."
        >
          <SimpleBarChart data={soByPriority} color="#d97706" />
        </DashboardChartCard>
        <DashboardChartCard
          title={`Tendencia de OS abertas (${period})`}
          icon={TrendingUp}
          loading={reportPending}
          empty={!soTrend.some((item) => item.count > 0)}
          emptyMessage="Nenhuma OS criada neste periodo."
        >
          <SimpleTrendChart data={soTrend} color="#2563eb" />
        </DashboardChartCard>
        <DashboardChartCard
          title={`Tendencia de alertas (${period})`}
          icon={TrendingUp}
          loading={reportPending}
          empty={!alertsTrend.some((item) => item.count > 0)}
          emptyMessage="Nenhum alerta registrado neste periodo."
        >
          <SimpleTrendChart data={alertsTrend} color="#d64545" />
        </DashboardChartCard>
      </section>

      <h2 className="dashboard-section-title">Rankings operacionais</h2>
      <section className="dashboard-ranking-grid">
        <DashboardRankingList
          title="Máquinas mais problemáticas"
          icon={AlertTriangle}
          items={mostProblematic}
          loading={reportPending}
          emptyMessage="Nenhuma máquina com alertas ativos."
          onSelectItem={onNavigateInventory}
          renderItem={(item) => (
            <>
              <strong>{item.name}</strong>
              <span>{item.occurrences} ocorrência(s) em {item.alertCount} alerta(s)</span>
            </>
          )}
        />
        <DashboardRankingList
          title="Máquinas sem contato recente"
          icon={WifiOff}
          items={notSeenRecently}
          loading={reportPending}
          emptyMessage="Todas as máquinas monitoradas estão online."
          onSelectItem={onNavigateInventory}
          renderItem={(item) => (
            <>
              <strong>{item.name}</strong>
              <span>{item.statusLabel} - {item.segmentName || "Sem segmento"}</span>
            </>
          )}
        />
        <DashboardRankingList
          title="Alertas mais recorrentes"
          icon={TrendingUp}
          items={topRecurringAssets}
          loading={reportPending}
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
          loading={reportPending}
          emptyMessage="Nenhuma OS em aberto."
          onSelectItem={onNavigateServiceOrders}
          renderItem={(item) => (
            <>
              <strong>{item.number} - {item.title}</strong>
              <span>Aberta desde {new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
            </>
          )}
        />
        <DashboardRankingList
          title="Técnicos com mais OS resolvidas"
          icon={Users}
          items={byTechnician}
          loading={reportPending}
          emptyMessage="Nenhuma OS finalizada com técnico atribuído ainda."
          renderItem={(item) => (
            <>
              <strong>{item.label}</strong>
              <span>{item.count} OS finalizada(s)</span>
            </>
          )}
        />
      </section>

      <h2 className="dashboard-section-title">Visão Business</h2>
      <section className="panel dashboard-business-card">
        <div className="panel-heading">
          <h3>Ambientes/organizações atendidas</h3>
          <Building2 size={18} />
        </div>
        {!business?.enabled || !byEnvironment.length ? (
          <p className="dashboard-empty-state">
            {reportPending ? "Carregando..." : business?.message || "Sem dados de ambiente/organização ainda."}
          </p>
        ) : (
          <ol className="dashboard-ranking-list">
            {byEnvironment.map((item) => (
              <li key={item.key}>
                <div className="dashboard-ranking-item">
                  <strong>{item.label}</strong>
                  <span>{item.count} ordem(ns) de serviço</span>
                </div>
              </li>
            ))}
          </ol>
        )}
        {business?.enabled && !business.clientsWithMostAlertsAvailable && (
          <p className="dashboard-empty-state dashboard-business-note">
            Alertas e ativos ainda não têm vínculo com o cadastro de clientes — essa métrica ficará disponível
            quando esse vínculo existir no sistema.
          </p>
        )}
      </section>
    </>
  );
}
