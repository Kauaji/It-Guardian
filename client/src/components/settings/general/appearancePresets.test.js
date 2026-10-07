import { describe, expect, it } from "vitest";
import { appearancePresets, appearanceVariableNames } from "./appearancePresets.js";

describe("appearancePresets", () => {
  it("o preset padrao nao define variaveis; os demais definem as 15 na mesma ordem", () => {
    const [standard, ...others] = appearancePresets;
    expect(standard).toMatchObject({ id: "default", values: null });
    expect(others.map((preset) => preset.id)).toEqual(["aurora", "nebula", "ocean", "sunset", "emerald", "cyber", "midnight"]);
    for (const preset of others) {
      expect(Object.keys(preset.values)).toEqual([
        "--app-bg",
        "--app-bg-layer",
        "--surface",
        "--surface-soft",
        "--surface-muted",
        "--accent",
        "--accent-hover",
        "--primary-button-bg",
        "--primary-button-hover",
        "--sidebar-bg",
        "--sidebar-bg-2",
        "--sidebar-text",
        "--sidebar-muted",
        "--border",
        "--border-strong"
      ]);
      expect(Object.values(preset.values).every(Boolean)).toBe(true);
      for (const name of Object.keys(preset.values)) expect(appearanceVariableNames).toContain(name);
    }
  });

  it("mantem os valores de referencia de alguns presets", () => {
    const byId = Object.fromEntries(appearancePresets.map((preset) => [preset.id, preset]));
    expect(byId.aurora.values).toMatchObject({
      "--app-bg": "#eaf8f5",
      "--app-bg-layer": "linear-gradient(135deg, #eaf8f5 0%, #eef9ff 48%, #e7fff6 100%)",
      "--accent": "#0f766e",
      "--border-strong": "#a9d3c9"
    });
    expect(byId.midnight.values["--surface"]).toBe("#172235");
    expect(byId.sunset.values["--primary-button-bg"]).toBe("#c2410c");
  });
});
