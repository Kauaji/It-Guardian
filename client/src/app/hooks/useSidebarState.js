import { useEffect, useRef, useState } from "react";

const autoCloseDelayMs = 950;

// Estado da sidebar: recolhida por padrao, abre ao passar o mouse e fica
// aberta enquanto um ativo/segmento e arrastado (para servir de alvo).
export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(true);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const wasCollapsedBeforeDrag = useRef(true);
  const autoCloseTimer = useRef(null);

  useEffect(() => {
    return () => window.clearTimeout(autoCloseTimer.current);
  }, []);

  const expanded = !collapsed || hoverOpen || dragActive;

  function handleMouseEnter() {
    if (!dragActive) setHoverOpen(true);
  }

  function handleMouseLeave() {
    if (dragActive) return;
    setHoverOpen(false);
    setCollapsed(true);
  }

  function toggleCollapsed() {
    setCollapsed((current) => !current);
  }

  function beginDrag() {
    wasCollapsedBeforeDrag.current = collapsed;
    window.clearTimeout(autoCloseTimer.current);
    setDragActive(true);
    setCollapsed(false);
  }

  function endDrag({ forceCollapse = false } = {}) {
    setDragActive(false);
    window.clearTimeout(autoCloseTimer.current);

    if (forceCollapse) {
      setHoverOpen(false);
      setCollapsed(true);
      return;
    }

    if (wasCollapsedBeforeDrag.current) {
      autoCloseTimer.current = window.setTimeout(() => setCollapsed(true), autoCloseDelayMs);
    }
  }

  return {
    beginDrag,
    collapsed,
    dragActive,
    endDrag,
    expanded,
    handleMouseEnter,
    handleMouseLeave,
    toggleCollapsed
  };
}
