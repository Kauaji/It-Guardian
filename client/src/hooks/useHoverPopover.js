import { useEffect, useRef, useState } from "react";

/**
 * Primitivo reaproveitado tanto pelos indicadores de metrica quanto pelo
 * tooltip de status na maquina do inventario - sem Tooltip/Popover
 * generico no projeto, e sem precedente de fechar-com-delay no hover em
 * lugar nenhum, entao construido uma unica vez aqui. O delay existe para
 * mover o mouse do gatilho para dentro do proprio popover nao piscar
 * fechado no meio do caminho.
 */
export function useHoverPopover({ closeDelayMs = 250 } = {}) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  function clearPendingClose() {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }

  function openNow() {
    clearPendingClose();
    setOpen(true);
  }

  function scheduleClose() {
    clearPendingClose();
    closeTimeoutRef.current = window.setTimeout(() => setOpen(false), closeDelayMs);
  }

  function closeNow() {
    clearPendingClose();
    setOpen(false);
  }

  function toggle() {
    if (open) closeNow();
    else openNow();
  }

  useEffect(() => clearPendingClose, []);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (popoverRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      closeNow();
    }

    function handleKeydown(event) {
      if (event.key === "Escape") {
        closeNow();
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  const triggerProps = {
    ref: triggerRef,
    onMouseEnter: openNow,
    onMouseLeave: scheduleClose,
    onFocus: openNow,
    onBlur: scheduleClose,
    "aria-expanded": open
  };

  const popoverProps = {
    ref: popoverRef,
    onMouseEnter: clearPendingClose,
    onMouseLeave: scheduleClose
  };

  return { open, openNow, closeNow, toggle, triggerProps, popoverProps };
}
