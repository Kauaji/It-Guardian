import { useCallback, useEffect, useState } from "react";
import { fetchAssetTimeline } from "../../../api.js";
import AssetTimelineEmptyState from "./AssetTimelineEmptyState.jsx";
import AssetTimelineEvent from "./AssetTimelineEvent.jsx";
import AssetTimelineFilters from "./AssetTimelineFilters.jsx";
import AssetTimelineSummary from "./AssetTimelineSummary.jsx";
import { formatDayLabel } from "./assetTimelineFormatters.js";
import { filterTimelineEvents, groupTimelineEventsByDay, mergeObservationsIntoEvents } from "./assetTimelineModel.js";

const PAGE_SIZE = 50;
const NETWORK_TOPOLOGY_DISCLAIMER =
  "Conexões do Mapa de Rede representam relação cadastrada manualmente e não medição real do enlace.";

export default function AssetTechnicalTimeline({ assetId, token, observations = [], onOpenNetworkMap }) {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [topologyReferences, setTopologyReferences] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [category, setCategory] = useState("all");
  const [period, setPeriod] = useState("all");
  const [onlyImportant, setOnlyImportant] = useState(false);
  const [queryText, setQueryText] = useState("");

  const loadPage = useCallback(
    async (offset, { append } = {}) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await fetchAssetTimeline(token, assetId, {
          category: category === "all" ? undefined : category,
          period,
          onlyImportant: onlyImportant || undefined,
          limit: PAGE_SIZE,
          offset
        });
        setEvents((current) => (append ? [...current, ...result.events] : result.events));
        setSummary(result.summary);
        setTopologyReferences(result.topologyReferences);
        setTotal(result.metadata?.total ?? result.events.length);
      } catch (err) {
        setError(err.message || "Não foi possível carregar o prontuário técnico.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [assetId, category, onlyImportant, period, token]
  );

  useEffect(() => {
    loadPage(0, { append: false });
  }, [assetId, category, period, onlyImportant]);

  const displayEvents = filterTimelineEvents(mergeObservationsIntoEvents(events, observations), {
    category,
    queryText
  });
  const groups = groupTimelineEventsByDay(displayEvents);
  const hasFilters = category !== "all" || period !== "all" || onlyImportant || Boolean(queryText.trim());
  const canLoadMore = events.length < total;

  const clearFilters = () => {
    setCategory("all");
    setPeriod("all");
    setOnlyImportant(false);
    setQueryText("");
  };

  return (
    <section className="asset-tab-content asset-timeline">
      <AssetTimelineSummary summary={summary} />

      {topologyReferences && topologyReferences.mapCount > 0 && (
        <div className="asset-timeline-topology-block">
          <strong>
            Este ativo aparece em {topologyReferences.mapCount} mapa
            {topologyReferences.mapCount > 1 ? "s" : ""} de rede.
          </strong>
          <ul>
            {topologyReferences.maps.map((map) => (
              <li key={map.mapId}>
                {map.mapName}
                {onOpenNetworkMap && (
                  <button type="button" className="link-action" onClick={() => onOpenNetworkMap(map.mapId)}>
                    Abrir mapa
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="asset-timeline-topology-disclaimer">{NETWORK_TOPOLOGY_DISCLAIMER}</p>
        </div>
      )}

      <AssetTimelineFilters
        category={category}
        onCategoryChange={setCategory}
        period={period}
        onPeriodChange={setPeriod}
        queryText={queryText}
        onQueryTextChange={setQueryText}
        onlyImportant={onlyImportant}
        onToggleOnlyImportant={setOnlyImportant}
        onRefresh={() => loadPage(0, { append: false })}
        refreshing={loading}
      />

      {error && <p className="error-message">{error}</p>}

      {loading && !events.length ? (
        <p className="loading-message">Carregando prontuário técnico...</p>
      ) : displayEvents.length === 0 ? (
        <AssetTimelineEmptyState hasFilters={hasFilters} onClearFilters={clearFilters} />
      ) : (
        <div className="asset-timeline-list">
          {groups.map((group) => (
            <div key={group.key} className="asset-timeline-day-group">
              <h4>{formatDayLabel(group.date)}</h4>
              {group.events.map((event) => (
                <AssetTimelineEvent key={event.id} event={event} />
              ))}
            </div>
          ))}
        </div>
      )}

      {canLoadMore && (
        <button
          type="button"
          className="ghost-action asset-timeline-load-more"
          onClick={() => loadPage(events.length, { append: true })}
          disabled={loadingMore}
        >
          {loadingMore ? "Carregando..." : "Carregar mais"}
        </button>
      )}
    </section>
  );
}
