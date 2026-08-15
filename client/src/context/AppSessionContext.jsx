import { createContext, useContext, useMemo } from "react";
import { hasPermission } from "../permissions.js";

const AppSessionContext = createContext(null);

export function AppSessionProvider({ value, children }) {
  const extended = useMemo(
    () => ({
      ...value,
      can: (permissionId) => hasPermission(value.user, permissionId)
    }),
    [value]
  );

  return <AppSessionContext.Provider value={extended}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) {
    throw new Error("useAppSession precisa ser usado dentro de um AppSessionProvider.");
  }
  return context;
}
