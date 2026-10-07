import { createContext, useContext } from "react";

// Contexto focado da Central de Avisos: permissoes e resolvedores de inventario
// compartilhados pelos componentes de abas e modais (evita repassar por props).
const AlertCenterViewContext = createContext(null);

export function AlertCenterViewProvider({ value, children }) {
  return <AlertCenterViewContext.Provider value={value}>{children}</AlertCenterViewContext.Provider>;
}

export function useAlertCenterView() {
  const context = useContext(AlertCenterViewContext);
  if (!context) {
    throw new Error("useAlertCenterView precisa ser usado dentro de um AlertCenterViewProvider.");
  }
  return context;
}
