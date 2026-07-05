import { useEffect } from "react";

export default function Toast({ message, tone, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, 4200);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return <div className={`toast ${tone}`}>{message}</div>;
}
