import { useMemo, useState } from "react";
import { buildCalendarDays, getCalendarRange } from "../calendarModel.js";
import { shiftMonth } from "../utils/calendarPage.js";

// Mes exibido: ancora, intervalo consultado e os 42 dias da grade.
export function useCalendarMonth() {
  const [anchor, setAnchor] = useState(() => new Date());
  const range = useMemo(() => getCalendarRange(anchor, "month"), [anchor]);
  const days = useMemo(() => buildCalendarDays(anchor, "month"), [anchor]);
  const move = (direction) => setAnchor((current) => shiftMonth(current, direction));
  return { anchor, range, days, move };
}
