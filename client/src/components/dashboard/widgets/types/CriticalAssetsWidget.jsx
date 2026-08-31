import { metricClass, statusClass } from "../../dashboardFormatters.js";
import WidgetList from "../WidgetList.jsx";
import { useDashboardFilters } from "../DashboardFilterContext.jsx";

export default function CriticalAssetsWidget({ data }) {
  const { enabled, filters, toggleFilter } = useDashboardFilters();
  return (
    <WidgetList
      items={data.rows}
      onSelectItem={enabled ? (asset) => toggleFilter("assetId", asset.id, asset.name) : undefined}
      isSelected={(asset) => filters.assetId === asset.id}
      emptyMessage="Nenhum ativo em estado critico agora."
      renderItem={(asset) => (
        <>
          <span>{asset.name}</span>
          <span className={`pill ${statusClass(asset.status) || ""}`}>{asset.status}</span>
          {asset.metrics && (
            <small>
              CPU <span className={metricClass(asset.metrics.cpu)}>{asset.metrics.cpu ?? "--"}%</span>{" "}
              RAM <span className={metricClass(asset.metrics.ram)}>{asset.metrics.ram ?? "--"}%</span>{" "}
              Disco <span className={metricClass(asset.metrics.disk)}>{asset.metrics.disk ?? "--"}%</span>
            </small>
          )}
        </>
      )}
    />
  );
}
