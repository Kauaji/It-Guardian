// Traducao de eventos do navegador em comandos de mouse/teclado para o agente.
export const MOUSE_MOVE_MIN_INTERVAL_MS = 80;

const forwardedNamedKeys = new Set([
  "Enter", "Escape", "Backspace", "Tab", "Delete", "Insert", "Home", "End",
  "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"
]);

function clampUnit(value) {
  return Math.max(0, Math.min(1, value));
}

// Posicao normalizada (0..1) do ponteiro dentro da area da tela remota.
export function pointerPosition(bounds, clientX, clientY) {
  return {
    x: clampUnit((clientX - bounds.left) / bounds.width),
    y: clampUnit((clientY - bounds.top) / bounds.height)
  };
}

export function mouseButtonName(button) {
  return button === 2 ? "right" : button === 1 ? "middle" : "left";
}

export function normalizeKey(key) {
  return key === " " ? "Space" : key;
}

// Teclas imprimiveis e uma lista fechada de teclas de navegacao/edicao.
export function isForwardableKey(key) {
  return key.length === 1 || forwardedNamedKeys.has(key);
}
