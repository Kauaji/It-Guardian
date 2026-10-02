import { useLocation } from "react-router-dom";
import AssetPublicView from "./components/inventory/AssetPublicView.jsx";
import PublicServiceOrderTracking from "./components/public/PublicServiceOrderTracking.jsx";
import PublicSupportRequest from "./components/public/PublicSupportRequest.jsx";
import ViewLoadingState from "./components/ui/ViewLoadingState.jsx";
import { useAppSessionController } from "./hooks/useAppSessionController.js";
import AppRoutes from "./app/routing/AppRoutes.jsx";
import { parsePublicLocation } from "./app/routing/publicLocation.js";

// Casca do app: paginas publicas (sem login) primeiro; depois a sessao e o
// roteamento do app autenticado (ver app/routing e app/AuthenticatedApp).
export default function App() {
  const location = useLocation();
  const publicLocation = parsePublicLocation(location);
  const session = useAppSessionController(publicLocation);

  if (publicLocation.kind === "tracking") {
    return <PublicServiceOrderTracking token={publicLocation.trackingToken} />;
  }

  if (publicLocation.kind === "support") {
    return <PublicSupportRequest />;
  }

  if (publicLocation.kind === "asset") {
    return <AssetPublicView assetId={publicLocation.assetId} />;
  }

  if (session.authLoading) {
    return <ViewLoadingState />;
  }

  return <AppRoutes session={session} />;
}
