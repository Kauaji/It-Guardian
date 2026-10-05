import { useEffect, useRef, useState } from "react";
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

  function onKeyDown(event) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close();
    } else if (event.key === "Tab" && open) {
      close({ restoreFocus: false });
    }
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
        onClick={() => setOpen((current) => !current)}
      >
        <UserRound size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="user-menu-panel" role="menu" aria-label="Minha conta">
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
