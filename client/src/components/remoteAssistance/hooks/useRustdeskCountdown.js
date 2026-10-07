import { useEffect, useState } from "react";

// Segundos restantes ate `expiresAt` (ISO); null quando nao ha expiracao.
export function useRustdeskCountdown(expiresAt) {
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(null);
      return undefined;
    }
    function tick() {
      const remaining = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return secondsLeft;
}
