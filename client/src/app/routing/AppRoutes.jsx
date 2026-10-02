import { useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AuthScreen from "../../components/auth/AuthScreen.jsx";
import Toast from "../../components/ui/Toast.jsx";
import { AppSessionProvider } from "../../context/AppSessionContext.jsx";
import AuthenticatedApp from "../AuthenticatedApp.jsx";
import { LOGIN_PATH, resolveLoginDestination } from "../routes.js";

// Roteamento de alto nivel: /login para quem nao tem sessao e o app
// autenticado em todas as demais URLs. Deslogado volta para /login guardando
// o destino pedido (location.state.from), e apos entrar retorna a ele. Quando
// a pessoa clica em "Sair" o destino nao e guardado (volta ao dashboard).
export default function AppRoutes({ session }) {
  const location = useLocation();
  const signOutRequested = useRef(false);
  const { clearToast, notify, toast, token, user } = session;
  const authenticated = Boolean(token && user);

  function handleAuth(data) {
    signOutRequested.current = false;
    session.handleAuth(data);
  }

  const appSession = {
    ...session,
    signOut() {
      signOutRequested.current = true;
      session.logout();
    }
  };

  return (
    <>
      <Routes>
        <Route
          path={LOGIN_PATH}
          element={
            authenticated ? (
              <Navigate to={resolveLoginDestination(location.state?.from)} replace />
            ) : (
              <AuthScreen notify={notify} onAuth={handleAuth} />
            )
          }
        />
        <Route
          path="*"
          element={
            authenticated ? (
              <AppSessionProvider value={appSession}>
                <AuthenticatedApp />
              </AppSessionProvider>
            ) : (
              <Navigate to={LOGIN_PATH} replace state={signOutRequested.current ? null : { from: location }} />
            )
          }
        />
      </Routes>
      <Toast message={toast.message} tone={toast.tone} onClose={clearToast} />
    </>
  );
}
