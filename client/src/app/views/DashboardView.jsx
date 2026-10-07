import { useAppSession } from "../../context/AppSessionContext.jsx";
import DashboardWorkspace from "../../components/dashboard/widgets/DashboardWorkspace.jsx";
import ViewErrorBoundary from "../../components/ui/ViewErrorBoundary.jsx";
import { useViewAccess } from "../hooks/useViewAccess.js";

export default function DashboardView() {
  const { token, notify } = useAppSession();
  const { canCustomizeDashboard } = useViewAccess();

  return (
    <ViewErrorBoundary label="o Dashboard" resetKey="dashboard">
      <DashboardWorkspace token={token} canCustomize={canCustomizeDashboard} notify={notify} />
    </ViewErrorBoundary>
  );
}
