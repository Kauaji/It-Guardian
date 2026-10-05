const MAX_WIDGETS = 30;
const MIN_REFRESH_SECONDS = 30;
const MAX_TITLE_LENGTH = 60;
const WIDTH_TIERS = new Set(["s", "m", "l", "xl"]);
const HEIGHT_TIERS = new Set(["s", "m", "l"]);

/**
 * Forma esperada de um widget do layout. A validacao abaixo existe justamente porque o
 * corpo vem do cliente e pode nao respeitar este contrato.
 * @typedef {object} WidgetInput
 * @property {string} id
 * @property {string} type
 * @property {number} x
 * @property {number} y
 * @property {string} w Largura: "s" | "m" | "l" | "xl".
 * @property {string} h Altura: "s" | "m" | "l".
 * @property {number} refreshIntervalSeconds
 * @property {object | null} [config]
 * @property {string | null} [title]
 */

/** @param {unknown} value */
function isFiniteNonNegativeInteger(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 0;
}

/**
 * Valida a forma de um layout de dashboard antes de persistir. O whitelist de
 * tipos vem do registry de widgets do proprio backend (nao de uma lista
 * fixa aqui) -- e a defesa principal contra um cliente desatualizado (ou
 * adulterado) persistindo um tipo que o servidor nao sabe mais renderizar.
 *
 * @param {unknown} data Corpo recebido; deve ter `widgets: Widget[]`.
 * @param {{ knownWidgetTypes: Set<string> }} options
 * @returns {true}
 * @throws {Error} Com `statusCode` 400 e todas as violacoes encontradas.
 */
export function validateDashboardLayout(data, { knownWidgetTypes }) {
  /** @type {string[]} */
  const errors = [];
  const candidate = /** @type {{ widgets?: unknown } | null | undefined} */ (data);
  /** @type {WidgetInput[] | null} */
  const widgets = Array.isArray(candidate?.widgets) ? candidate.widgets : null;

  if (!widgets) {
    errors.push("O layout precisa ter uma lista de widgets.");
    throwIfAny(errors);
    return true;
  }

  if (widgets.length > MAX_WIDGETS) {
    errors.push(`O dashboard aceita no maximo ${MAX_WIDGETS} widgets.`);
  }

  const ids = new Set();
  for (const widget of widgets) {
    if (!widget?.id || typeof widget.id !== "string") {
      errors.push("Widget sem identificador.");
      continue;
    }
    if (ids.has(widget.id)) {
      errors.push(`Widget duplicado: ${widget.id}.`);
      continue;
    }
    ids.add(widget.id);

    if (typeof widget.type !== "string" || !knownWidgetTypes.has(widget.type)) {
      errors.push(`Widget ${widget.id} tem um tipo desconhecido.`);
      continue;
    }

    if (!isFiniteNonNegativeInteger(widget.x) || !isFiniteNonNegativeInteger(widget.y)) {
      errors.push(`Widget ${widget.id} tem posicao invalida.`);
    }

    if (!WIDTH_TIERS.has(widget.w)) {
      errors.push(`Widget ${widget.id} tem largura invalida.`);
    }
    if (!HEIGHT_TIERS.has(widget.h)) {
      errors.push(`Widget ${widget.id} tem altura invalida.`);
    }

    if (
      !Number.isInteger(widget.refreshIntervalSeconds) ||
      widget.refreshIntervalSeconds < MIN_REFRESH_SECONDS
    ) {
      errors.push(`Widget ${widget.id} precisa de um intervalo de atualizacao de pelo menos ${MIN_REFRESH_SECONDS}s.`);
    }

    if (widget.config != null && (typeof widget.config !== "object" || Array.isArray(widget.config))) {
      errors.push(`Widget ${widget.id} tem uma configuracao invalida.`);
    }

    if (widget.title != null && (typeof widget.title !== "string" || widget.title.length > MAX_TITLE_LENGTH)) {
      errors.push(`Widget ${widget.id} tem um titulo invalido (maximo ${MAX_TITLE_LENGTH} caracteres).`);
    }
  }

  throwIfAny(errors);
  return true;
}

/** @param {string[]} errors */
function throwIfAny(errors) {
  if (!errors.length) return;
  /** @type {Error & { statusCode?: number }} */
  const error = new Error(`Layout de dashboard invalido: ${errors.join(" ")}`);
  error.statusCode = 400;
  throw error;
}
