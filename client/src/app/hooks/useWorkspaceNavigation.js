import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { ACCOUNT_VIEW_ID, BLOCKED_VIEW_ID, DEFAULT_VIEW_ID, pathForView, viewIdFromPath } from "../routes.js";

const OPEN_INVENTORY_BOARD_EVENT = "it-guardian:open-inventory-board";

function dispatchOpenInventoryBoard(detail) {
  window.dispatchEvent(detail ? new CustomEvent(OPEN_INVENTORY_BOARD_EVENT, { detail }) : new CustomEvent(OPEN_INVENTORY_BOARD_EVENT));
}

// Liga a URL ao restante do app: calcula a visao ativa (ja respeitando as
// permissoes), redireciona visoes nao permitidas e expoe as acoes de
// navegacao que antes viviam espalhadas pelo Dashboard.
export function useWorkspaceNavigation(access) {
  const { signOut } = useAppSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [calendarFocusOrder, setCalendarFocusOrder] = useState(null);
  const { permittedViewIds } = access;

  const requestedView = viewIdFromPath(location.pathname);
  const effectiveRequested = requestedView || DEFAULT_VIEW_ID;
  // A pagina da conta nao depende de permissao: vale para qualquer logado.
  const activeView =
    requestedView === ACCOUNT_VIEW_ID || permittedViewIds.includes(effectiveRequested)
      ? effectiveRequested
      : permittedViewIds[0] || BLOCKED_VIEW_ID;

  useEffect(() => {
    if (!requestedView || activeView === BLOCKED_VIEW_ID || activeView === requestedView) return;
    navigate(pathForView(activeView), { replace: true });
  }, [activeView, navigate, requestedView]);

  const goToView = useCallback(
    (viewId) => {
      const path = pathForView(viewId);
      navigate(path, { replace: location.pathname === path });
    },
    [location.pathname, navigate]
  );

  // Estes dois eventos fazem o InventoryBoard (ja montado) voltar para a aba
  // de quadro; o segundo, adiado, cobre o caso em que ele monta depois.
  const openInventory = useCallback(() => {
    goToView("inventory");
    dispatchOpenInventoryBoard();
    window.setTimeout(() => dispatchOpenInventoryBoard(), 0);
  }, [goToView]);

  const openInventoryAsset = useCallback(
    (assetId) => {
      goToView("inventory");
      window.setTimeout(() => dispatchOpenInventoryBoard({ assetId }), 0);
    },
    [goToView]
  );

  const openCalendar = useCallback(
    (order, createEvent) => {
      setCalendarFocusOrder(createEvent ? order : null);
      goToView("calendar");
    },
    [goToView]
  );

  const clearCalendarFocus = useCallback(() => setCalendarFocusOrder(null), []);

  return {
    activeView,
    calendarFocusOrder,
    clearCalendarFocus,
    goToView,
    logout: signOut,
    openCalendar,
    openInventory,
    openInventoryAsset
  };
}
