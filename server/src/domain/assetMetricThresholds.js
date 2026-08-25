const CRITICAL_METRIC_THRESHOLD = 90;
const WARNING_METRIC_THRESHOLD = 85;

export function isMetricCritical(value) {
  return Number.isFinite(value) && value >= CRITICAL_METRIC_THRESHOLD;
}

export function isMetricWarning(value) {
  return Number.isFinite(value) && value >= WARNING_METRIC_THRESHOLD;
}

export function averageMinutesBetween(orders, startField, endField) {
  const diffs = orders
    .map((order) => {
      const start = Date.parse(order[startField]);
      const end = Date.parse(order[endField]);
      return Number.isFinite(start) && Number.isFinite(end) && end >= start ? (end - start) / 60000 : null;
    })
    .filter((value) => value != null);

  if (!diffs.length) return null;
  return Math.round(diffs.reduce((sum, value) => sum + value, 0) / diffs.length);
}
