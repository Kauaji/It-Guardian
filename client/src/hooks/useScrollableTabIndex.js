import { useEffect, useRef, useState } from "react";

// Regioes rolaveis precisam de acesso por teclado (WCAG 2.1.1, axe `scrollable-region-focusable`):
// quando o conteudo transborda, o container entra na ordem de tab (tabIndex 0) para rolar com as
// setas. Sem transbordo nao ha parada extra de tab.
export function useScrollableTabIndex() {
  const ref = useRef(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setScrollable(element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });

  return { ref, tabIndex: scrollable ? 0 : undefined, scrollable };
}
