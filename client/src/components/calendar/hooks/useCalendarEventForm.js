import { useEffect, useState } from "react";
import {
  applyHierarchySelection,
  applyInferredHierarchy,
  applyServiceOrderSelection,
  buildEventPayload,
  hierarchyOptions,
  inferHierarchyPatch,
  initialEventForm,
  selectableServiceOrders
} from "../utils/calendarHierarchy.js";

// Estado do formulario do evento: campos, hierarquia dependente e vinculo com a OS.
export function useCalendarEventForm({ event, selectedDate, defaults, serviceOrders, devices, segments, groups }) {
  const [form, setForm] = useState(() => initialEventForm(event, selectedDate, defaults));
  useEffect(() => setForm(initialEventForm(event, selectedDate, defaults)), [defaults, event, selectedDate]);
  const set = (field) => (e) =>
    setForm((current) => ({ ...current, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const orders = selectableServiceOrders(serviceOrders);
  const options = hierarchyOptions(form, { groups, segments, devices });

  const { assetId, groupId, segmentId, tabId } = form;
  useEffect(() => {
    const patch = inferHierarchyPatch({ assetId, groupId, segmentId, tabId }, { devices, segments, groups });
    if (patch) setForm((current) => applyInferredHierarchy(current, patch));
  }, [assetId, devices, groupId, groups, segmentId, segments, tabId]);

  const selectHierarchy = (field, value) => setForm((current) => applyHierarchySelection(current, field, value));
  const selectServiceOrder = (serviceOrderId) =>
    setForm((current) => applyServiceOrderSelection(current, serviceOrderId, { orders, devices, segments, groups }));

  return { form, set, selectHierarchy, selectServiceOrder, orders, ...options, buildPayload: () => buildEventPayload(form) };
}
