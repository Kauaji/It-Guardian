import { useDashboardSummary } from "../../hooks/useDashboardSummary.js";
import DashboardFilters from "./DashboardFilters.jsx";
import DashboardHealthScore from "./DashboardHealthScore.jsx";
import DashboardKpiStrip from "./DashboardKpiStrip.jsx";
import DashboardQuickActions from "./DashboardQuickActions.jsx";
import DashboardAssetsCard from "./page/DashboardAssetsCard.jsx";
import DashboardBottomGrid from "./page/DashboardBottomGrid.jsx";
import DashboardBusinessSection from "./page/DashboardBusinessSection.jsx";
import DashboardChartsSection from "./page/DashboardChartsSection.jsx";
import { DashboardDeviceToolbar, DashboardDevicesSection } from "./page/DashboardDevicesSection.jsx";
import DashboardRankingsSection from "./page/DashboardRankingsSection.jsx";
import { buildKpiItems, buildReportSlices } from "./page/reportSlices.js";

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
  const slices = buildReportSlices(report);
  const reportPending = reportLoading && !report;

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

      <DashboardKpiStrip loading={reportPending} items={buildKpiItems(slices.overview)} />

      <section className="dashboard-instrument-row">
        <DashboardHealthScore health={slices.overview?.infrastructureHealth} loading={reportPending} />
        {summary && <DashboardAssetsCard summary={summary} />}
      </section>

      <DashboardDeviceToolbar search={search} setSearch={setSearch} status={status} setStatus={setStatus} />
      <DashboardDevicesSection
        loading={loading}
        devices={devices}
        selectedId={selectedId}
        selectDevice={selectDevice}
        alerts={alerts}
      />
      <DashboardBottomGrid selectedDevice={selectedDevice} history={history} />

      <DashboardChartsSection slices={slices} period={period} pending={reportPending} />
      <DashboardRankingsSection
        slices={slices}
        period={period}
        pending={reportPending}
        onNavigateInventory={onNavigateInventory}
        onNavigateAlerts={onNavigateAlerts}
        onNavigateServiceOrders={onNavigateServiceOrders}
      />
      <DashboardBusinessSection
        business={slices.business}
        byEnvironment={slices.byEnvironment}
        pending={reportPending}
      />
    </>
  );
}
