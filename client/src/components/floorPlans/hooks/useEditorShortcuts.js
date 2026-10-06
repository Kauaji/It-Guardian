import { useEffect, useRef } from "react";
import { appendDigitToBuffer } from "../utils/measurementGeometry.js";
import { isTypingTarget, resolveShortcutCommands } from "../utils/keyboardShortcuts.js";

/**
 * Atalhos de teclado do editor (espaco = pan, G = grade, Esc, Ctrl+Z/Y/D, R,
 * Delete e digitos durante a medicao). Os ouvintes de janela sao registrados
 * uma unica vez por tela; o tratamento sempre usa o estado mais recente.
 */
export function useEditorShortcuts({ view, doc, ui, viewport, paint, placementApi, entities, transforms }) {
  const { undo, redo } = doc;
  const { placement, paintDraft, setPlacement, setShowGrid, setPaintDraft, clearSelection, setSelectionBox, setSelectedTool } = ui;
  const latestRef = useRef(null);

  const runCommand = (command) => {
    switch (command.type) {
      case "pan-ready":
        viewport.setSpacePressed(true);
        break;
      case "toggle-grid":
        setShowGrid((current) => !current);
        break;
      case "cancel-paint":
        paint.paintPointerRef.current = false;
        setPaintDraft(null);
        setSelectedTool("select");
        break;
      case "cancel-placement":
        setPlacement(null);
        break;
      case "clear-selection":
        clearSelection();
        setSelectionBox(null);
        break;
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
      case "rotate":
        transforms.rotateSelected();
        break;
      case "delete":
        entities.deleteSelectedEntity();
        break;
      case "duplicate":
        transforms.duplicateSelected();
        break;
      case "measurement-commit":
        placementApi.commitMeasurementFromKeyboard();
        break;
      case "measurement-digit":
        setPlacement((current) =>
          current ? { ...current, lengthBuffer: appendDigitToBuffer(current.lengthBuffer || "", command.key) } : current
        );
        break;
      default:
        break;
    }
  };

  const handleKeyDown = (event) => {
    if (isTypingTarget(event.target)) return;
    resolveShortcutCommands(event, { placement, paintDraft }).forEach((command) => {
      if (command.preventDefault) event.preventDefault();
      runCommand(command);
    });
  };

  latestRef.current = { handleKeyDown, releaseSpace: () => viewport.setSpacePressed(false) };

  useEffect(() => {
    if (view !== "editor") return undefined;
    const onKeyDown = (event) => latestRef.current.handleKeyDown(event);
    const onKeyUp = (event) => {
      if (event.code === "Space") latestRef.current.releaseSpace();
    };
    const onBlur = () => latestRef.current.releaseSpace();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [view]);
}
