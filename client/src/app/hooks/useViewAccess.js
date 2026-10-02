import { useMemo } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { getViewAccess } from "../viewAccess.js";

export function useViewAccess() {
  const { user } = useAppSession();
  return useMemo(() => getViewAccess(user), [user]);
}
