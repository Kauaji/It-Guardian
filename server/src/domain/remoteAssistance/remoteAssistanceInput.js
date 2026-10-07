const allowedMouseButtons = new Set(["left", "right", "middle"]);

const allowedMouseActions = new Set(["down", "up", "click"]);

const allowedKeyActions = new Set(["down", "up", "press"]);

const namedKeys = new Set([
  "Enter",
  "Escape",
  "Backspace",
  "Tab",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space"
]);

/**
 * @typedef {{ type: "mouse_move", x: number, y: number }
 *   | { type: "mouse_button", button: string, action: string }
 *   | { type: "mouse_wheel", delta: number }
 *   | { type: "key", key: string, action: string }
 *   | { type: "block_input", enabled: boolean }} InputCommand
 */

/**
 * @param {unknown} input Comando de entrada enviado pelo visualizador (nao confiavel).
 * @returns {InputCommand | null} `null` quando o comando e invalido.
 */
export function sanitizeInputCommand(input) {
  /** @type {Record<string, unknown>} Corpo cru do navegador; cada campo e validado abaixo. */
  const value = input && typeof input === "object" ? /** @type {Record<string, unknown>} */ (input) : {};
  const type = String(value.type || "").trim();
  if (type === "mouse_move") {
    const x = Number(value.x);
    const y = Number(value.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { type, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }
  if (type === "mouse_button") {
    const button = String(value.button || "").toLowerCase();
    const action = String(value.action || "").toLowerCase();
    if (!allowedMouseButtons.has(button) || !allowedMouseActions.has(action)) return null;
    return { type, button, action };
  }
  if (type === "mouse_wheel") {
    const delta = Number(value.delta);
    if (!Number.isFinite(delta)) return null;
    return { type, delta: Math.max(-1200, Math.min(1200, Math.trunc(delta))) };
  }
  if (type === "key") {
    const key = String(value.key || "");
    const action = String(value.action || "press").toLowerCase();
    const printable = key.length === 1 && key.charCodeAt(0) >= 0x20 && key.charCodeAt(0) <= 0x7e;
    if ((!printable && !namedKeys.has(key)) || !allowedKeyActions.has(action)) return null;
    return { type, key, action };
  }
  if (type === "block_input") {
    return { type, enabled: Boolean(value.enabled) };
  }
  return null;
}
