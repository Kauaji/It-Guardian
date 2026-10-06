import { useMemo } from "react";
import { eventsByDay } from "./calendarModel.js";
import CalendarEventModal from "./CalendarEventModal.jsx";
import CalendarFilters from "./components/CalendarFilters.jsx";
import CalendarGrid from "./components/CalendarGrid.jsx";
import CalendarHeader from "./components/CalendarHeader.jsx";
import CalendarSummaryStrip from "./components/CalendarSummaryStrip.jsx";
import { useCalendarActions } from "./hooks/useCalendarActions.js";
import { useCalendarData } from "./hooks/useCalendarData.js";
import { useCalendarFilters } from "./hooks/useCalendarFilters.js";
import { useCalendarMonth } from "./hooks/useCalendarMonth.js";
import { filterEventsBySearch } from "./utils/calendarPage.js";
import "./technicalCalendar.css";

export default function TechnicalCalendarPage({
  token,
  notify,
  serviceOrders = [],
  devices = [],
  segments = [],
  groups = [],
  tabs = [],
  permissions = {},
  focusServiceOrder,
  onFocusHandled
}) {
  const { anchor, range, days, move } = useCalendarMonth();
  const { filters, filtersOpen, toggleFilters, setFilter, setGroupFilter, filterSegments, activeFilterCount } =
    useCalendarFilters(segments);
  const { events, summary, technicians, loading, load } = useCalendarData({ token, notify, range, filters });
  const actions = useCalendarActions({ token, notify, load, focusServiceOrder, onFocusHandled });
  const { modal } = actions;

  const visibleEvents = useMemo(() => filterEventsBySearch(events, filters.search), [events, filters.search]);
  const grouped = useMemo(() => eventsByDay(visibleEvents), [visibleEvents]);

  return (
    <section className="technical-calendar-page">
      <CalendarHeader
        search={filters.search}
        onSearch={setFilter("search")}
        anchor={anchor}
        onMove={move}
        canCreate={permissions.create}
        onNew={actions.openNew}
        filtersOpen={filtersOpen}
        activeFilterCount={activeFilterCount}
        onToggleFilters={toggleFilters}
      />
      <CalendarSummaryStrip summary={summary} />
      {filtersOpen ? (
        <CalendarFilters
          filters={filters}
          technicians={technicians}
          groups={groups}
          filterSegments={filterSegments}
          serviceOrders={serviceOrders}
          onChange={setFilter}
          onChangeGroup={setGroupFilter}
        />
      ) : null}
      <CalendarGrid
        days={days}
        anchor={anchor}
        grouped={grouped}
        loading={loading}
        hasEvents={visibleEvents.length > 0}
        canCreate={permissions.create}
        onOpenDay={actions.openDay}
        onOpenEvent={actions.openEvent}
      />
      {modal ? (
        <CalendarEventModal
          event={modal.event}
          selectedDate={modal.date}
          defaults={modal.defaults}
          technicians={technicians}
          serviceOrders={serviceOrders}
          devices={devices}
          segments={segments}
          groups={groups}
          tabs={tabs}
          permissions={permissions}
          saving={actions.saving}
          onClose={actions.closeModal}
          onSave={actions.save}
          onCancel={actions.cancel}
          onComplete={actions.complete}
          onDelete={actions.remove}
        />
      ) : null}
    </section>
  );
}
