const CRITICAL_METRIC_THRESHOLD = 90;
const WARNING_METRIC_THRESHOLD = 85;

/** @param {unknown} value Percentual de uso. */
export function isMetricCritical(value) {
  return Number.isFinite(value) && /** @type {number} */ (value) >= CRITICAL_METRIC_THRESHOLD;
}

/** @param {unknown} value Percentual de uso. */
export function isMetricWarning(value) {
  return Number.isFinite(value) && /** @type {number} */ (value) >= WARNING_METRIC_THRESHOLD;
}

/**
 * Media, em minutos arredondados, entre dois campos de data de uma lista de registros.
 * Ignora pares invalidos ou com fim anterior ao inicio.
 *
 * @param {Array<Record<string, unknown>>} orders
 * @param {string} startField
 * @param {string} endField
 * @returns {number | null} null quando nenhum par e valido.
 */
export function averageMinutesBetween(orders, startField, endField) {
  const diffs = orders
    .map((order) => {
      const start = Date.parse(String(order[startField]));
      const end = Date.parse(String(order[endField]));
      return Number.isFinite(start) && Number.isFinite(end) && end >= start ? (end - start) / 60000 : null;
    })
    .filter(/** @returns {value is number} */ (value) => value != null);

  if (!diffs.length) return null;
  return Math.round(diffs.reduce((sum, value) => sum + value, 0) / diffs.length);
}
