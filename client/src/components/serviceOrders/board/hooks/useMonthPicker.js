import { useEffect, useMemo, useState } from "react";
import { buildServiceOrderMonthValues } from "../../serviceOrderBoardUtils.js";

// Seletor de mes/ano: modo (meses ou anos), ano exibido e opcoes derivadas das OS.
export function useMonthPicker({ serviceOrders, monthFilter }) {
  const [mode, setMode] = useState("months");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const availableMonthValues = useMemo(() => buildServiceOrderMonthValues(serviceOrders), [serviceOrders]);
  const availableYears = useMemo(
    () => [...new Set(availableMonthValues.map((value) => Number(value.slice(0, 4))))].sort((left, right) => left - right),
    [availableMonthValues]
  );
  const monthsForYear = useMemo(
    () => availableMonthValues.filter((value) => Number(value.slice(0, 4)) === year),
    [availableMonthValues, year]
  );

  useEffect(() => {
    if (monthFilter) {
      setYear(Number(monthFilter.slice(0, 4)));
    } else if (availableYears.length) {
      setYear(availableYears.at(-1));
    }
  }, [monthFilter, availableYears]);

  function toggleMode() {
    setMode((current) => (current === "years" ? "months" : "years"));
  }

  function pickYear(value) {
    setYear(value);
    setMode("months");
  }

  return { mode, year, availableYears, monthsForYear, toggleMode, pickYear };
}
