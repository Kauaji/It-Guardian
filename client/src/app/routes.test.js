import { describe, expect, it } from "vitest";
import {
  labelForView,
  pathForView,
  resolveLoginDestination,
  viewIdFromPath,
  viewRoutes
} from "./routes.js";

describe("tabela de rotas", () => {
  it("mapeia cada URL em portugues para a visao correspondente", () => {
    expect(viewIdFromPath("/")).toBe("dashboard");
    expect(viewIdFromPath("/avisos")).toBe("alerts");
    expect(viewIdFromPath("/ordens-de-servico")).toBe("service-orders");
    expect(viewIdFromPath("/agenda")).toBe("calendar");
    expect(viewIdFromPath("/pecas")).toBe("parts-inventory");
    expect(viewIdFromPath("/inventario")).toBe("inventory");
  });

  it("mantem as URLs de plantas (lista, planta e editor) dentro do inventario", () => {
    expect(viewIdFromPath("/plantas")).toBe("inventory");
    expect(viewIdFromPath("/plantas/abc")).toBe("inventory");
    expect(viewIdFromPath("/plantas/abc/editor")).toBe("inventory");
  });

  it("devolve null para URLs desconhecidas e para sub-rotas inexistentes", () => {
    expect(viewIdFromPath("/nada")).toBeNull();
    expect(viewIdFromPath("/avisos/extra")).toBeNull();
    expect(viewIdFromPath("/login")).toBeNull();
  });

  it("gera o caminho canonico de cada visao, com fallback para a raiz", () => {
    expect(pathForView("inventory")).toBe("/inventario");
    expect(pathForView("service-orders")).toBe("/ordens-de-servico");
    expect(pathForView("desconhecida")).toBe("/");
  });

  it("usa os mesmos rotulos da interface", () => {
    expect(labelForView("service-orders")).toBe("Ordens de Serviço");
    expect(labelForView("calendar")).toBe("Agenda Técnica");
    expect(labelForView("parts-inventory")).toBe("Inventário de Peças");
    expect(labelForView("inventory")).toBe("Inventário de Ativos");
    expect(labelForView("x")).toBe("");
  });

  it("nao repete ids nem caminhos entre visoes", () => {
    const ids = viewRoutes.map((route) => route.id);
    const paths = viewRoutes.flatMap((route) => route.paths);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("resolveLoginDestination", () => {
  it("devolve o caminho com busca e hash do destino pedido", () => {
    expect(resolveLoginDestination({ pathname: "/agenda", search: "?dia=1", hash: "#x" })).toBe("/agenda?dia=1#x");
    expect(resolveLoginDestination({ pathname: "/pecas" })).toBe("/pecas");
  });

  it("cai na raiz sem destino, para a tela de login ou para URLs externas", () => {
    expect(resolveLoginDestination(undefined)).toBe("/");
    expect(resolveLoginDestination({ pathname: "/login" })).toBe("/");
    expect(resolveLoginDestination({ pathname: "//evil.example" })).toBe("/");
    expect(resolveLoginDestination({ pathname: "https://evil.example" })).toBe("/");
  });
});
