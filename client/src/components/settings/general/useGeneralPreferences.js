import { useEffect, useState } from "react";
import { accentColorKey, defaultCustomTheme, generalPreferencesKey } from "./appearancePresets.js";
import { applyGeneralPreferences, readGeneralPreferences } from "./generalPreferences.js";

/** Estado das preferências de usabilidade/aparência; cada mudança persiste e aplica no <html>. */
export function useGeneralPreferences(theme) {
  const [preferences, setPreferences] = useState(readGeneralPreferences);

  useEffect(() => {
    applyGeneralPreferences(preferences);
  }, [theme]);

  function savePreferences(nextPreferences) {
    setPreferences(nextPreferences);
    localStorage.setItem(generalPreferencesKey, JSON.stringify(nextPreferences));
    applyGeneralPreferences(nextPreferences);
  }

  function changeFontScale(fontScale) {
    savePreferences({ ...preferences, fontScale });
  }

  function selectAppearancePreset(presetId) {
    savePreferences({ ...preferences, appearancePreset: presetId });
  }

  function changeCustomTheme(field, value) {
    const nextPreferences = {
      ...preferences,
      appearancePreset: "custom",
      customTheme: {
        ...preferences.customTheme,
        [field]: value
      }
    };
    if (field === "accent") {
      localStorage.setItem(accentColorKey, value);
    }
    savePreferences(nextPreferences);
  }

  function restoreDefaultAppearance() {
    const nextPreferences = {
      ...preferences,
      appearancePreset: "default",
      customTheme: defaultCustomTheme
    };
    localStorage.removeItem(accentColorKey);
    savePreferences(nextPreferences);
  }

  return { preferences, changeFontScale, selectAppearancePreset, changeCustomTheme, restoreDefaultAppearance };
}
