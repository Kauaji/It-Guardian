import { useEffect, useId, useRef, useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ACCOUNT_SECURITY_PATH } from "../../auth/accountRoutes.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import "./auth.css";

// Menu da conta na topbar. Teclado: Enter/Espaco/Seta abaixo abre, Escape
// fecha e devolve o foco ao botao, Tab fecha o menu.
export default function UserMenu() {
  const { user } = useAppSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const firstItemRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    firstItemRef.current?.focus();

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close({ restoreFocus = true } = {}) {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }

  function menuItems() {
    return Array.from(rootRef.current?.querySelectorAll('[role="menuitem"]') || []);
  }

  function moveFocus(event, target) {
    event.preventDefault();
    const items = menuItems();
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    const next = { first: 0, last: items.length - 1, next: (current + 1) % items.length, previous: (current - 1 + items.length) % items.length }[target];
    items[next].focus();
  }

  function onKeyDown(event) {
    if (!open) {
      // Seta abaixo/acima no botao abre o menu (padrao WAI-ARIA de botao de menu).
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && event.target === buttonRef.current) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close({ restoreFocus: false });
    } else if (event.key === "ArrowDown") moveFocus(event, "next");
    else if (event.key === "ArrowUp") moveFocus(event, "previous");
    else if (event.key === "Home") moveFocus(event, "first");
    else if (event.key === "End") moveFocus(event, "last");
  }

  function openAccount() {
    close({ restoreFocus: false });
    navigate(ACCOUNT_SECURITY_PATH);
  }

  return (
    <div className="user-menu" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button"
        title="Minha conta"
        aria-label="Minha conta"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <UserRound size={18} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} className="user-menu-panel" role="menu" aria-label="Minha conta">
          <div className="user-menu-identity">
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </div>
          <button ref={firstItemRef} type="button" role="menuitem" onClick={openAccount}>
            <ShieldCheck size={16} aria-hidden="true" /> Segurança da conta
          </button>
        </div>
      )}
    </div>
  );
}
