import { useEffect } from "react";

const MIN_INSPECTOR_HEIGHT = 180;
const INSPECTOR_MARGIN = 20;
const CSS_VARIABLE = "--floor-plan-inspector-max-height";

/** Altura maxima do inspetor: o que cabe entre o topo do palco e o catalogo. */
export function computeInspectorMaxHeight(stageBox, catalogBox) {
  return Math.max(MIN_INSPECTOR_HEIGHT, Math.min(stageBox.height - INSPECTOR_MARGIN, catalogBox.top - stageBox.top - INSPECTOR_MARGIN));
}

/**
 * Mantem a variavel CSS `--floor-plan-inspector-max-height` do palco atualizada
 * enquanto ha um item selecionado em modo de edicao (resize, rolagem e
 * mudancas de tamanho do palco ou do catalogo).
 */
export function useInspectorMaxHeight({ isEditing, selected, activeCatalog, stageRef, catalogRef }) {
  useEffect(() => {
    if (!isEditing || !selected) return undefined;
    const stage = stageRef.current;
    const catalog = catalogRef.current;
    if (!stage || !catalog) return undefined;

    let frame = 0;
    const updateInspectorHeight = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const availableHeight = computeInspectorMaxHeight(stage.getBoundingClientRect(), catalog.getBoundingClientRect());
        stage.style.setProperty(CSS_VARIABLE, `${availableHeight}px`);
      });
    };

    updateInspectorHeight();
    const resizeObserver = new ResizeObserver(updateInspectorHeight);
    resizeObserver.observe(stage);
    resizeObserver.observe(catalog);
    window.addEventListener("resize", updateInspectorHeight);
    window.addEventListener("scroll", updateInspectorHeight, true);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateInspectorHeight);
      window.removeEventListener("scroll", updateInspectorHeight, true);
      stage.style.removeProperty(CSS_VARIABLE);
    };
  }, [activeCatalog, isEditing, selected]);
}
