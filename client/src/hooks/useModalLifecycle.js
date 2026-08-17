import { useEffect, useRef } from "react";

let openModalCount = 0;
let modalStack = [];
let nextModalId = 0;

const focusableSelector =
  "[autofocus], button:not([disabled]), input:not([disabled]), select:not([disabled]), " +
  "textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

function updateDocumentModalState() {
  document.body.classList.toggle("modal-open", openModalCount > 0);
}

function isVisible(element) {
  if (element.hasAttribute("hidden")) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function getFocusableElements(dialog) {
  if (!dialog) return [];
  return Array.from(dialog.querySelectorAll(focusableSelector)).filter(isVisible);
}

export function useModalLifecycle(open, onClose) {
  const dialogRef = useRef(null);
  const idRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    if (idRef.current === null) {
      nextModalId += 1;
      idRef.current = nextModalId;
    }
    const id = idRef.current;

    const previouslyFocused = document.activeElement;
    openModalCount += 1;
    modalStack.push(id);
    updateDocumentModalState();

    const focusTimer = window.setTimeout(() => {
      const focusTarget = getFocusableElements(dialogRef.current)[0];
      focusTarget?.focus();
    }, 0);

    function handleKeydown(event) {
      // Modais aninhados (ex.: assistencia remota aberta de dentro dos
      // detalhes de uma maquina) compartilham o mesmo listener no window;
      // so o modal mais recentemente aberto (o mais interno) deve reagir a
      // Escape/Tab, senao os dois niveis fechariam/disputariam foco juntos.
      if (modalStack[modalStack.length - 1] !== id) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      // Focus trap: mantem o foco dentro do modal enquanto ele estiver aberto,
      // em vez de deixar Tab/Shift+Tab escapar para o conteudo por tras do backdrop.
      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = getFocusableElements(dialog);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
          if (active === first || !dialog.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !dialog.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeydown);
      openModalCount = Math.max(0, openModalCount - 1);
      modalStack = modalStack.filter((entry) => entry !== id);
      updateDocumentModalState();
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return dialogRef;
}
