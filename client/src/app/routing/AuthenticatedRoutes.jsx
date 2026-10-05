import { Navigate, Route, Routes } from "react-router-dom";
import AccountSecurityPage from "../../components/auth/AccountSecurityPage.jsx";
import PermissionBlocked from "../../components/ui/PermissionBlocked.jsx";
import { useNavigation } from "../context/workspaceContexts.js";
import { ACCOUNT_SECURITY_PATH, BLOCKED_VIEW_ID, DEFAULT_VIEW_ID, pathForView, viewRoutes } from "../routes.js";
import { viewComponents } from "../views/index.js";

// So renderiza a visao quando ela e a visao ativa (ja filtrada por
// permissao), evitando um instante de tela nao autorizada antes do redirect.
function RequireView({ children, viewId }) {
  const { activeView } = useNavigation();
  return activeView === viewId ? children : null;
}

// Rotas das visoes do app autenticado. URL desconhecida cai no dashboard e
// visao sem permissao e redirecionada por useWorkspaceNavigation.
export default function AuthenticatedRoutes() {
  const { activeView } = useNavigation();

  if (activeView === BLOCKED_VIEW_ID) return <PermissionBlocked />;

  return (
    <Routes>
      <Route path={ACCOUNT_SECURITY_PATH} element={<AccountSecurityPage />} />
      {viewRoutes.flatMap((route) => {
        const View = viewComponents[route.id];
        return route.paths.map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <RequireView viewId={route.id}>
                <View />
              </RequireView>
            }
          />
        ));
      })}
      <Route path="*" element={<Navigate to={pathForView(DEFAULT_VIEW_ID)} replace />} />
    </Routes>
  );
}
