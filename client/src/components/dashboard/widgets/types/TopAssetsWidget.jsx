import { metricClass } from "../../dashboardFormatters.js";
import WidgetList from "../WidgetList.jsx";

const metricLabels = { cpu: "CPU", ram: "RAM", disk: "Disco" };

export default function TopAssetsWidget({ data }) {
  return (
    <>
      <WidgetList
        items={data.rows}
        emptyMessage={`Nenhum ativo com dado de ${metricLabels[data.metric] || data.metric} disponivel.`}
        renderItem={(asset) => (
          <>
            <span>{asset.name}</span>
            <strong className={metricClass(asset.value)}>{asset.value}%</strong>
          </>
        )}
      />
      {data.rows?.length > 0 && <small className="dashboard-widget-caption">Valor atual, nao uma media historica.</small>}
    </>
  );
}
