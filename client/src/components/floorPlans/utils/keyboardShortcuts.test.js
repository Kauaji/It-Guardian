import { describe, expect, it } from "vitest";
import { isTypingTarget, resolveShortcutCommands } from "./keyboardShortcuts.js";

const key = (name, extra = {}) => ({
  key: name,
  code: `Key${name.toUpperCase()}`,
  ctrlKey: false,
  metaKey: false,
  repeat: false,
  ...extra
});
const types = (commands) => commands.map((command) => command.type);
const idle = { placement: null, paintDraft: null };

describe("isTypingTarget", () => {
  it("reconhece campos de formulario e elementos editaveis", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("resolveShortcutCommands", () => {
  it("espaco prepara o pan", () => {
    expect(resolveShortcutCommands({ key: " ", code: "Space" }, idle)).toEqual([{ type: "pan-ready", preventDefault: true }]);
  });

  it("G alterna a grade, exceto em repeticao", () => {
    expect(types(resolveShortcutCommands(key("g"), idle))).toEqual(["toggle-grid"]);
    expect(resolveShortcutCommands(key("g", { repeat: true }), idle)).toEqual([]);
  });

  it("Esc cancela primeiro o pincel, depois o posicionamento, depois limpa a selecao", () => {
    expect(types(resolveShortcutCommands({ key: "Escape" }, { placement: { kind: "wall" }, paintDraft: {} }))).toEqual(["cancel-paint"]);
    expect(types(resolveShortcutCommands({ key: "Escape" }, { placement: { kind: "wall" }, paintDraft: null }))).toEqual([
      "cancel-placement"
    ]);
    expect(resolveShortcutCommands({ key: "Escape" }, idle)).toEqual([{ type: "clear-selection", preventDefault: false }]);
  });

  it("Ctrl/Cmd+Z, Ctrl/Cmd+Y e Ctrl/Cmd+D", () => {
    expect(types(resolveShortcutCommands(key("z", { ctrlKey: true }), idle))).toEqual(["undo"]);
    expect(types(resolveShortcutCommands(key("Y", { metaKey: true }), idle))).toEqual(["redo"]);
    expect(types(resolveShortcutCommands(key("d", { ctrlKey: true }), idle))).toEqual(["duplicate"]);
    expect(resolveShortcutCommands(key("z"), idle)).toEqual([]);
  });

  it("R gira e Delete/Backspace excluem", () => {
    expect(types(resolveShortcutCommands(key("r"), idle))).toEqual(["rotate"]);
    expect(types(resolveShortcutCommands({ key: "Delete" }, idle))).toEqual(["delete"]);
    expect(types(resolveShortcutCommands({ key: "Backspace" }, idle))).toEqual(["delete"]);
  });

  it("durante a medicao, Enter confirma e digitos compoem o comprimento", () => {
    const measuring = { placement: { kind: "measurement", start: { x: 0, y: 0 } }, paintDraft: null };
    expect(types(resolveShortcutCommands({ key: "Enter" }, measuring))).toEqual(["measurement-commit"]);
    expect(resolveShortcutCommands({ key: "3" }, measuring)).toEqual([{ type: "measurement-digit", key: "3", preventDefault: true }]);
    expect(types(resolveShortcutCommands({ key: "," }, measuring))).toEqual(["measurement-digit"]);
    // Backspace edita o comprimento em vez de excluir a selecao
    expect(types(resolveShortcutCommands({ key: "Backspace" }, measuring))).toEqual(["measurement-digit"]);
  });

  it("sem ponto inicial, a medicao nao captura teclas", () => {
    const notStarted = { placement: { kind: "measurement", start: null }, paintDraft: null };
    expect(resolveShortcutCommands({ key: "3" }, notStarted)).toEqual([]);
    expect(types(resolveShortcutCommands({ key: "Backspace" }, notStarted))).toEqual(["delete"]);
  });
});
