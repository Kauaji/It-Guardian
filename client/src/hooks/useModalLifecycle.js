import { useEffect, useRef } from "react";

let openModalCount = 0;

function updateDocumentModalState() {
  document.body.classList.toggle("modal-open", openModalCount > 0);
}

export function useModalLifecycle(open, onClose) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    openModalCount += 1;
    updateDocumentModalState();

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      const focusTarget = dialog?.querySelector(
        "[autofocus], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
      focusTarget?.focus();
    }, 0);

    function handleKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeydown);
      openModalCount = Math.max(0, openModalCount - 1);
      updateDocumentModalState();
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return dialogRef;
}
