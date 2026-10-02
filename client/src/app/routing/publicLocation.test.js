import { describe, expect, it } from "vitest";
import { parsePublicLocation } from "./publicLocation.js";

describe("parsePublicLocation", () => {
  it("reconhece o formulario publico de chamado nas duas URLs", () => {
    for (const pathname of ["/abrir-chamado", "/solicitar-suporte"]) {
      expect(parsePublicLocation({ pathname })).toMatchObject({
        kind: "support",
        isPublicSupportPath: true
      });
    }
  });

  it("reconhece o acompanhamento por token e decodifica o token", () => {
    const result = parsePublicLocation({ pathname: "/chamado/abc%20123/status" });
    expect(result).toMatchObject({ kind: "tracking", trackingToken: "abc 123", isPublicSupportPath: true });
  });

  it("reconhece a ficha publica de ativo por caminho ou por query string", () => {
    expect(parsePublicLocation({ pathname: "/assets/a%2F1" })).toMatchObject({
      kind: "asset",
      assetId: "a/1",
      isPublicSupportPath: false
    });
    expect(parsePublicLocation({ pathname: "/", search: "?asset=xyz" })).toMatchObject({
      kind: "asset",
      assetId: "xyz"
    });
  });

  it("respeita a precedencia: acompanhamento > formulario > ativo", () => {
    expect(parsePublicLocation({ pathname: "/chamado/t1", search: "?asset=9" }).kind).toBe("tracking");
    expect(parsePublicLocation({ pathname: "/abrir-chamado", search: "?asset=9" }).kind).toBe("support");
  });

  it("nao trata rotas do app como publicas", () => {
    expect(parsePublicLocation({ pathname: "/" })).toMatchObject({ kind: null, assetId: null });
    expect(parsePublicLocation({ pathname: "/abrir-chamado/extra" }).kind).toBeNull();
    expect(parsePublicLocation()).toMatchObject({ kind: null });
  });
});
