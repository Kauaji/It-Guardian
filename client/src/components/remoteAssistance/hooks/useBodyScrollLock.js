import { useEffect } from "react";

// Trava o scroll do body enquanto o dialogo esta aberto.
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [locked]);
}
