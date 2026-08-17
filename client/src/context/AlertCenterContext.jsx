import { createContext, useContext } from "react";

const AlertCenterContext = createContext(null);

export function AlertCenterProvider({ value, children }) {
  return <AlertCenterContext.Provider value={value}>{children}</AlertCenterContext.Provider>;
}

export function useAlertCenterData() {
  const context = useContext(AlertCenterContext);
  if (!context) {
    throw new Error("useAlertCenterData precisa ser usado dentro de um AlertCenterProvider.");
  }
  return context;
}
