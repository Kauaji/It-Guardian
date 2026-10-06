import { useDashboardFilters } from "./DashboardFilterContext.jsx";
import WidgetChartFrame from "./WidgetChartFrame.jsx";
import { buildCategoryChartModel } from "./categoryChartModel.js";
import { CategoryBarsVariant, CategoryHeatmapVariant, CategoryStatsVariant } from "./WidgetCategoryListVariants.jsx";
import { CategoryLegend, renderColumnsChart, renderPieChart, renderRadialChart } from "./WidgetCategoryGraphics.jsx";

export default function WidgetCategoryChart({
  rows = [],
  variant = "bars",
  dimension,
  emptyMessage,
  suffix = "",
  showPercentages = false,
  percentageTotal
}) {
  const { filters, enabled, toggleFilter } = useDashboardFilters();
  const model = buildCategoryChartModel({
    rows,
    filters,
    enabled,
    toggleFilter,
    dimension,
    suffix,
    showPercentages,
    percentageTotal
  });
  const { entries } = model;

  if (!entries.length || (!suffix && !entries.some((row) => row.value > 0))) {
    return <p className="dashboard-empty-state">{emptyMessage || "Nenhum dado neste recorte. Remova um filtro para ampliar a análise."}</p>;
  }

  if (variant === "stats") return <CategoryStatsVariant model={model} />;
  if (variant === "bars" || variant === "list") return <CategoryBarsVariant model={model} variant={variant} />;
  if (variant === "heatmap") return <CategoryHeatmapVariant model={model} />;

  const isPie = variant === "pie" || variant === "donut";
  const isRadial = variant === "radial";

  return (
    <div className={"dashboard-category-chart " + (isPie ? "circular" : isRadial ? "radial" : "columns")}>
      {/* Pizza/rosca/radial: os setores do recharts sao <path role="img"> sem texto; o grafico e decorativo
          porque a legenda logo abaixo traz os mesmos dados como botoes acessiveis. A barra mantem a camada
          de acessibilidade propria do recharts (foco por teclado). */}
      <div className="dashboard-chart-visual" style={{ display: "contents" }} aria-hidden={isPie || isRadial ? "true" : undefined}>
        <WidgetChartFrame>
          {isPie ? renderPieChart(model, variant) : isRadial ? renderRadialChart(model) : renderColumnsChart(model)}
        </WidgetChartFrame>
      </div>
      <CategoryLegend model={model} />
    </div>
  );
}
