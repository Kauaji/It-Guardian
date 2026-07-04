import { useEffect, useId, useRef, useState } from "react";

const recurrenceLabels = {
  daily: "Diaria",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  custom_days: "Personalizada"
};

function formatDateTime(value) {
  if (!value) return "Nao agendada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nao agendada";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function normalizeAutomationIndicators(indicators = []) {
  return Array.isArray(indicators) ? indicators.filter(Boolean) : [];
}

export function getVisibleAutomationIndicators(indicators = [], maxVisible = 4) {
  const safeIndicators = normalizeAutomationIndicators(indicators);
  const safeMaxVisible = Math.max(1, Number(maxVisible) || 4);

  return {
    visibleIndicators: safeIndicators.slice(0, safeMaxVisible),
    hiddenIndicators: safeIndicators.slice(safeMaxVisible),
    hiddenCount: Math.max(0, safeIndicators.length - safeMaxVisible)
  };
}

export function formatAutomationIndicatorLabel(indicator = {}) {
  const name = indicator.planName || indicator.name || "Plano preventivo";
  const recurrence = recurrenceLabels[indicator.recurrenceType] || indicator.recurrenceType || "Recorrencia";
  const interval = indicator.recurrenceIntervalDays || indicator.recurrenceInterval;
  const recurrenceText = interval ? `${recurrence} - ${interval} dia(s)` : recurrence;
  const preferredTime = indicator.preferredTime || "--:--";
  const nextRun = formatDateTime(indicator.nextScheduledFor || indicator.nextRunAt);
  const scriptCount = Number(indicator.scriptCount || indicator.defaultScriptIds?.length || 0);
  const status = indicator.active === false ? "Inativo" : "Ativo";

  return `${name}. ${recurrenceText}. Horario: ${preferredTime}. Proxima preparacao: ${nextRun}. Scripts: ${scriptCount}. Status: ${status}.`;
}

export default function AutomationIndicatorDots({
  indicators = [],
  maxVisible = 4,
  onSelectPlan,
  compact = false,
  interactive = true
}) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const safeIndicators = normalizeAutomationIndicators(indicators);
  const { visibleIndicators, hiddenIndicators, hiddenCount } = getVisibleAutomationIndicators(safeIndicators, maxVisible);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeydown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  if (!safeIndicators.length) return null;

  function handleSelect(indicator) {
    onSelectPlan?.(indicator);
    setOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className={`automation-indicator-dots ${compact ? "compact" : ""}`}
      aria-label="Planos preventivos automatizados"
    >
      <div className="automation-indicator-dot-row">
        {visibleIndicators.map((indicator) => {
          const label = formatAutomationIndicatorLabel(indicator);
          const key = `${indicator.automationPlanId || indicator.id}-${indicator.assetId || ""}`;

          return interactive ? (
            <button
              key={key}
              type="button"
              className="automation-indicator-dot-button"
              style={{ "--automation-indicator-color": indicator.indicatorColor || "#1f7a61" }}
              title={label}
              aria-label={label}
              onClick={(event) => {
                event.stopPropagation();
                triggerRef.current = event.currentTarget;
                handleSelect(indicator);
              }}
            />
          ) : (
            <span
              key={key}
              className="automation-indicator-dot-button is-visual"
              style={{ "--automation-indicator-color": indicator.indicatorColor || "#1f7a61" }}
              title={label}
              aria-label={label}
              role="img"
            />
          );
        })}
        {hiddenCount > 0 && (
          interactive ? (
            <button
              type="button"
              className="automation-indicator-more"
              aria-label={`Ver mais ${hiddenCount} plano(s) preventivo(s) automatizado(s)`}
              aria-expanded={open}
              aria-controls={popoverId}
              title={`+${hiddenCount} plano(s)`}
              onClick={(event) => {
                event.stopPropagation();
                triggerRef.current = event.currentTarget;
                setOpen((current) => !current);
              }}
            >
              +{hiddenCount}
            </button>
          ) : (
            <span className="automation-indicator-more is-visual" title={`Mais ${hiddenCount} plano(s)`}>
              +{hiddenCount}
            </span>
          )
        )}
      </div>

      {interactive && open && (
        <div id={popoverId} className="automation-indicator-popover" role="dialog" aria-label="Planos automatizados">
          {(hiddenCount > 0 ? hiddenIndicators : visibleIndicators).map((indicator) => (
            <button
              key={`popover-${indicator.automationPlanId || indicator.id}-${indicator.assetId || ""}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onSelectPlan?.(indicator);
              }}
            >
              <span style={{ backgroundColor: indicator.indicatorColor || "#1f7a61" }} />
              <strong>{indicator.planName || indicator.name || "Plano preventivo"}</strong>
              <small>{formatAutomationIndicatorLabel(indicator)}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
