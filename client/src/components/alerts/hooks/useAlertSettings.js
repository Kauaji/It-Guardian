import { useEffect, useState } from "react";
import { defaultPriorityColors, normalizePrioritySettings } from "../alertUtils.js";

const closedSections = { rules: false, priority: false, scripts: false };

// Modal de configuracoes de aviso: abertura, secoes recolhiveis e rascunho das
// janelas operacionais, prioridades e cores (salvo pelo contexto da Central).
export default function useAlertSettings({ alertPrioritySettings, onSaveAlertPrioritySettings }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(closedSections);
  const [priorityDraft, setPriorityDraft] = useState(() => normalizePrioritySettings(alertPrioritySettings));
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [priorityColorsOpen, setPriorityColorsOpen] = useState(false);

  useEffect(() => {
    setPriorityDraft(normalizePrioritySettings(alertPrioritySettings));
  }, [alertPrioritySettings]);

  useEffect(() => {
    if (!settingsOpen) return;
    setSectionsOpen(closedSections);
    setPriorityColorsOpen(false);
  }, [settingsOpen]);

  function toggleSection(section) {
    setSectionsOpen((current) => ({ ...current, [section]: !current[section] }));
  }

  function updatePriorityDraft(section, field, value) {
    setPriorityDraft((current) => ({
      ...current,
      [section]: { ...current[section], [field]: value }
    }));
  }

  function updateOperationalDraft(field, value) {
    setPriorityDraft((current) => ({ ...current, [field]: value }));
  }

  function changeColor(priority, color) {
    setPriorityDraft((current) => ({
      ...current,
      priorityColors: { ...current.priorityColors, [priority]: color }
    }));
  }

  function resetColors() {
    setPriorityDraft((current) => ({ ...current, priorityColors: defaultPriorityColors }));
  }

  async function save() {
    if (!onSaveAlertPrioritySettings) return;
    setPrioritySaving(true);
    try {
      const normalized = normalizePrioritySettings(priorityDraft);
      const saved = await onSaveAlertPrioritySettings(normalized);
      setPriorityDraft(normalizePrioritySettings(saved || normalized));
    } finally {
      setPrioritySaving(false);
    }
  }

  return {
    settingsOpen,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    sectionsOpen,
    toggleSection,
    priorityDraft,
    prioritySaving,
    priorityColorsOpen,
    toggleColorsOpen: () => setPriorityColorsOpen((current) => !current),
    updatePriorityDraft,
    updateOperationalDraft,
    changeColor,
    resetColors,
    save
  };
}
