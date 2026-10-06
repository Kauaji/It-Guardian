import { describe, expect, it } from "vitest";
import { describeDevice, formatDateTime } from "./userAgent.js";

describe("describeDevice", () => {
  it("combina navegador e sistema", () => {
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36")).toBe(
      "Chrome em Windows"
    );
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537 Edg/120")).toBe("Edge em Windows");
    expect(describeDevice("Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0")).toBe("Firefox em Linux");
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toBe("Safari em iOS");
    expect(describeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605")).toBe("Safari em macOS");
    expect(describeDevice("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537")).toBe("Chrome em Android");
    expect(describeDevice("Opera/9.80 (Windows NT 6.1)")).toBe("Opera em Windows");
  });

  it("cai em partes ou em desconhecido", () => {
    expect(describeDevice("curl/8.0 (Linux)")).toBe("Linux");
    expect(describeDevice("Safari/1 compat")).toBe("Safari");
    expect(describeDevice("curl/8.0")).toBe("Dispositivo desconhecido");
    expect(describeDevice("")).toBe("Dispositivo desconhecido");
    expect(describeDevice(null)).toBe("Dispositivo desconhecido");
  });
});

describe("formatDateTime", () => {
  it("formata em pt-BR e tolera valores invalidos", () => {
    expect(formatDateTime("2026-10-02T15:30:00Z")).toMatch(/\d{2}\/\d{2}\/\d{2,4}/);
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("nao-e-data")).toBe("—");
  });
});
