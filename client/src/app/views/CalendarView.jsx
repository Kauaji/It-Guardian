import { lazy, Suspense } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import ViewErrorBoundary from "../../components/ui/ViewErrorBoundary.jsx";
import ViewLoadingState from "../../components/ui/ViewLoadingState.jsx";
import { useInventory, useNavigation, useWorkspaceData } from "../context/workspaceContexts.js";
import { calendarPermissions } from "../viewAccess.js";

const TechnicalCalendarPage = lazy(() => import("../../components/calendar/TechnicalCalendarPage.jsx"));

export default function CalendarView() {
  const { token, user, notify } = useAppSession();
  const { serviceOrders } = useWorkspaceData();
  const { model } = useInventory();
  const { calendarFocusOrder, clearCalendarFocus } = useNavigation();

  return (
    <ViewErrorBoundary label="a Agenda Técnica" resetKey="calendar">
      <Suspense fallback={<ViewLoadingState />}>
        <TechnicalCalendarPage
          token={token}
          notify={notify}
          serviceOrders={serviceOrders}
          devices={model.decoratedAllDevices}
          segments={model.decoratedSegments}
          groups={model.decoratedSegmentGroups}
          tabs={model.inventoryTabs}
          focusServiceOrder={calendarFocusOrder}
          onFocusHandled={clearCalendarFocus}
          permissions={calendarPermissions(user)}
        />
      </Suspense>
    </ViewErrorBoundary>
  );
}
