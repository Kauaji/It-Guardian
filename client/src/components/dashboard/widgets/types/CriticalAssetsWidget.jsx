import { metricClass, statusClass } from "../../dashboardFormatters.js";
import WidgetList from "../WidgetList.jsx";

export default function CriticalAssetsWidget({ data }) {
  return (
    <WidgetList
      items={data.rows}
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
