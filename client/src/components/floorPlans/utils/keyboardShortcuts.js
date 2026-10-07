const LENGTH_KEYS = [",", ".", "Backspace"];

/** Campos de formulario recebem as teclas normalmente (sem atalhos do editor). */
export function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return ["input", "textarea", "select"].includes(tagName) || Boolean(target?.isContentEditable);
}

function isLengthKey(key) {
  return /^[0-9]$/.test(key) || LENGTH_KEYS.includes(key);
}

function resolveEscape({ placement, paintDraft }) {
  if (paintDraft) return { stop: true, commands: [{ type: "cancel-paint", preventDefault: true }] };
  if (placement) return { stop: true, commands: [{ type: "cancel-placement", preventDefault: true }] };
  return { stop: false, commands: [{ type: "clear-selection", preventDefault: false }] };
}

function resolveModifierShortcuts(event) {
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;
  const commands = [];
  if (modifier && key === "z") commands.push({ type: "undo", preventDefault: true });
  if (modifier && key === "y") commands.push({ type: "redo", preventDefault: true });
  if (key === "r") commands.push({ type: "rotate", preventDefault: true });
  if (event.key === "Delete" || event.key === "Backspace") commands.push({ type: "delete", preventDefault: true });
  if (modifier && key === "d") commands.push({ type: "duplicate", preventDefault: true });
  return commands;
}

/**
 * Traduz um evento de teclado em comandos do editor, na ordem em que devem ser
 * executados. Cada comando indica se o evento deve ter `preventDefault`.
 * Durante o desenho de uma medida, Enter confirma e digitos compoem o
 * comprimento (e interrompem a resolucao dos demais atalhos).
 */
export function resolveShortcutCommands(event, { placement, paintDraft }) {
  const commands = [];
  if (event.code === "Space") commands.push({ type: "pan-ready", preventDefault: true });
  if (placement?.kind === "measurement" && placement.start) {
    if (event.key === "Enter") return [...commands, { type: "measurement-commit", preventDefault: true }];
    if (isLengthKey(event.key)) {
      return [...commands, { type: "measurement-digit", key: event.key, preventDefault: true }];
    }
  }
  if (event.key.toLowerCase() === "g" && !event.repeat) commands.push({ type: "toggle-grid", preventDefault: true });
  if (event.key === "Escape") {
    const escape = resolveEscape({ placement, paintDraft });
    commands.push(...escape.commands);
    if (escape.stop) return commands;
  }
  return [...commands, ...resolveModifierShortcuts(event)];
}
