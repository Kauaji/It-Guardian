import { describe, expect, it } from "vitest";
import { isPrivateNetworkUrl, resolveApiBaseUrl } from "./api.js";

describe("configuração pública da API", () => {
  it.each([
    "http://localhost:4000",
    "ws://localhost:4000/ws",
    "http://127.0.0.1:4000",
    "http://10.0.0.8:4000",
    "http://172.16.0.8:4000",
    "http://172.31.255.8:4000",
    "http://192.168.1.8:4000",
    "http://169.254.1.8:4000"
  ])("reconhece endereço privado: %s", (url) => {
    expect(isPrivateNetworkUrl(url)).toBe(true);
  });

  it("mantém endereços públicos", () => {
    expect(isPrivateNetworkUrl("https://api.itguardian.example")).toBe(false);
  });

  it("usa a API da mesma origem quando um build público recebe localhost", () => {
    expect(resolveApiBaseUrl({ configuredUrl: "http://localhost:4000", isDev: false })).toBe(
      "/api"
    );
  });

  it("preserva localhost durante o desenvolvimento", () => {
    expect(resolveApiBaseUrl({ configuredUrl: "http://localhost:4000", isDev: true })).toBe(
      "http://localhost:4000"
    );
  });

  it("aceita uma API pública configurada", () => {
    expect(
      resolveApiBaseUrl({ configuredUrl: "https://api.itguardian.example", isDev: false })
    ).toBe("https://api.itguardian.example");
  });
});
