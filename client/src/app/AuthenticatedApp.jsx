import WorkspaceProvider from "./context/WorkspaceProvider.jsx";
import AppLayout from "./layout/AppLayout.jsx";
import AuthenticatedRoutes from "./routing/AuthenticatedRoutes.jsx";

// App autenticado: dados/estado do workspace + casca visual + visoes roteadas.
export default function AuthenticatedApp() {
  return (
    <WorkspaceProvider>
      <AppLayout>
        <AuthenticatedRoutes />
      </AppLayout>
    </WorkspaceProvider>
  );
}
