import { FolderTree, PanelLeftClose } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import "./networkTopologyNavigation.css";

/** A narrow hover rail keeps the canvas wide; the button also works on touch. */
export default function NetworkTopologyNavigation({ children }) {
  const panelId = useId();
  const triggerRef = useRef(null);
  const shellRef = useRef(null);
  const pointerInside = useRef(false);
  const suppressFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);

  const closeNavigation = useCallback(() => {
    const restoreFocus = shellRef.current?.contains(document.activeElement);
    setOpen(false);
    setPinnedOpen(false);
    if (restoreFocus) {
      suppressFocus.current = true;
      triggerRef.current?.focus();
      suppressFocus.current = false;
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onOutsidePointerDown = (event) => {
      if (shellRef.current?.contains(event.target)) return;
      setOpen(false);
      setPinnedOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // A hover-open panel may not own focus. Let an active dialog handle
      // Escape first; closing navigation must never steal its focus.
      if (document.body.classList.contains("modal-open") ||
          event.target?.closest?.('[role="dialog"], [role="alertdialog"], dialog[open]')) return;
      event.preventDefault();
      event.stopPropagation();
      closeNavigation();
    };
    document.addEventListener("pointerdown", onOutsidePointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onOutsidePointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeNavigation]);

  return (
    <aside
      ref={shellRef}
      className={`network-topology-navigation ${open ? "is-open" : ""}`}
      aria-label="Navegação do mapa de rede"
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        pointerInside.current = true;
        setOpen(true);
      }}
      onPointerLeave={() => {
        pointerInside.current = false;
        if (!pinnedOpen && !shellRef.current?.contains(document.activeElement)) setOpen(false);
      }}
      onFocusCapture={() => {
        if (!suppressFocus.current) setOpen(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPinnedOpen(false);
          if (!pointerInside.current) setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="network-topology-navigation-trigger"
        aria-label="Abrir navegação do mapa"
        aria-expanded={open}
        aria-controls={panelId}
        title="Ambientes, grupos e segmentos"
        onClick={() => {
          setOpen(true);
          setPinnedOpen(true);
        }}
      >
        <FolderTree size={19} aria-hidden="true" />
        <span aria-hidden="true">Navegar</span>
      </button>
      <div id={panelId} className="network-topology-navigation-panel" hidden={!open}>
        <div className="network-topology-navigation-heading">
          <div>
            <strong>Explorar inventário</strong>
            <span>Ambientes, grupos e segmentos</span>
          </div>
          <button
            type="button"
            className="network-topology-navigation-close"
            aria-label="Recolher navegação do mapa"
            onClick={closeNavigation}
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </aside>
  );
}
