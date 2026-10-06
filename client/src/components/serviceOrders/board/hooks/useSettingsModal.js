import { useEffect, useMemo, useState } from "react";
import { useModalLifecycle } from "../../../../hooks/useModalLifecycle.js";
import { settingsTabs } from "../../serviceOrderBoardUtils.js";

// Estado de navegacao do modal de configuracoes: aba, secao aberta e cores das prioridades.
export function useSettingsModal({ settingsOpen, setSettingsOpen, setFiltersOpen, businessMode }) {
  const [settingsTab, setSettingsTab] = useState("general");
  const [generalSettingsSection, setGeneralSettingsSection] = useState("");
  const [showPriorityColorConfig, setShowPriorityColorConfig] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    setGeneralSettingsSection("");
    setShowPriorityColorConfig(false);
    setFiltersOpen(false);
  }, [settingsOpen]);

  const dialogRef = useModalLifecycle(settingsOpen, () => setSettingsOpen(false));

  const visibleSettingsTabs = useMemo(
    () => settingsTabs.filter((tab) => businessMode || tab.id !== "clients"),
    [businessMode]
  );

  useEffect(() => {
    if (!businessMode && settingsTab === "clients") {
      setSettingsTab("general");
    }
  }, [businessMode, settingsTab]);

  function togglePriorityColorConfig() {
    setShowPriorityColorConfig((current) => !current);
  }

  return {
    dialogRef,
    settingsTab,
    setSettingsTab,
    visibleSettingsTabs,
    generalSettingsSection,
    setGeneralSettingsSection,
    showPriorityColorConfig,
    togglePriorityColorConfig
  };
}
