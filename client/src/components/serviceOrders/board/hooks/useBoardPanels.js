import { useState } from "react";

// Paineis do quadro (filtros, mes, configuracoes, formulario) e a OS aberta no detalhe.
// Abrir um painel fecha os popovers concorrentes, como no quadro original.
export function useBoardPanels() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  function toggleMonthPicker() {
    setFiltersOpen(false);
    setMonthPickerOpen((current) => !current);
  }

  function toggleSettings() {
    setMonthPickerOpen(false);
    setFiltersOpen(false);
    setSettingsOpen((current) => !current);
  }

  function toggleFilters() {
    setMonthPickerOpen(false);
    setFiltersOpen((current) => !current);
  }

  function openForm() {
    setFiltersOpen(false);
    setFormOpen(true);
  }

  return {
    filtersOpen,
    setFiltersOpen,
    monthPickerOpen,
    setMonthPickerOpen,
    settingsOpen,
    setSettingsOpen,
    formOpen,
    setFormOpen,
    selectedOrder,
    setSelectedOrder,
    toggleMonthPicker,
    toggleSettings,
    toggleFilters,
    openForm
  };
}
