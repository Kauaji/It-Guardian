import { describe, expect, it } from "vitest";
import {
  DEFAULT_REFRESH_SECONDS,
  buildWidgetFromCatalog,
  createWidgetId,
  patchWidgetIn,
  removeWidgetFrom,
  replaceWidgetIn
} from "./workspaceModel.js";

describe("workspaceModel", () => {
  it("createWidgetId gera ids unicos com prefixo", () => {
    const a = createWidgetId();
    expect(a).toMatch(/^widget-[a-z0-9]+-[a-z0-9]+$/);
    expect(createWidgetId()).not.toBe(a);
  });

  it("buildWidgetFromCatalog usa tamanho do catalogo ou o padrao", () => {
    const withSize = buildWidgetFromCatalog({ type: "x", defaultSize: { w: "l", h: "m" }, config: { chartType: "pie" } }, 3);
    expect(withSize).toMatchObject({ type: "x", x: 0, y: 3, w: "l", h: "m", refreshIntervalSeconds: DEFAULT_REFRESH_SECONDS, config: { chartType: "pie" } });
    const bare = buildWidgetFromCatalog({ type: "y" }, 0);
    expect(bare).toMatchObject({ w: "m", h: "s", config: {} });
  });

  it("remove, ajusta e substitui widgets sem mutar a lista", () => {
    const list = [{ id: "a", y: 0, w: "m" }, { id: "b", y: 1, w: "m" }, { id: "c", y: 2, w: "m" }];
    const removed = removeWidgetFrom(list, "b");
    expect(removed.map((w) => w.id)).toEqual(["a", "c"]);
    expect(removed.map((w) => w.y)).toEqual([0, 1]);
    expect(patchWidgetIn(list, "b", { w: "l" })[1].w).toBe("l");
    expect(list[1].w).toBe("m");
    expect(replaceWidgetIn(list, { id: "c", y: 2, w: "s" })[2].w).toBe("s");
  });
});
