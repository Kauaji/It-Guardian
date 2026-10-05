import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText, downloadTextFile } from "./clipboard.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("copyText", () => {
  it("copia e devolve true", async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyText("abc")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("abc");
  });

  it("devolve false quando a area de transferencia nao esta disponivel ou recusa", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copyText("abc")).resolves.toBe(false);
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("negado")) } });
    await expect(copyText("abc")).resolves.toBe(false);
  });
});

describe("downloadTextFile", () => {
  it("gera um link temporario com o nome do arquivo e o revoga", () => {
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadTextFile("codigos.txt", "A\nB");

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
