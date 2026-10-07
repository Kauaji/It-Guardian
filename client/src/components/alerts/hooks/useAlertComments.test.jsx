import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useAlertComments from "./useAlertComments.js";

describe("useAlertComments", () => {
  it("guarda rascunhos por aviso", () => {
    const { result } = renderHook(() => useAlertComments({ canComment: true, onAddAlertComment: vi.fn() }));

    act(() => result.current.onChange("a1", "texto"));
    act(() => result.current.onChange("a2", "outro"));

    expect(result.current.drafts).toEqual({ a1: "texto", a2: "outro" });
    expect(result.current.canComment).toBe(true);
  });

  it("envia o comentário sem espaços nas pontas e limpa o rascunho", async () => {
    const onAddAlertComment = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAlertComments({ canComment: true, onAddAlertComment }));

    act(() => result.current.onChange("a1", "  oi  "));
    await act(async () => result.current.onSubmit("a1"));

    expect(onAddAlertComment).toHaveBeenCalledWith("a1", "oi");
    expect(result.current.drafts.a1).toBe("");
  });

  it("não envia comentário vazio nem sem handler", async () => {
    const onAddAlertComment = vi.fn();
    const comHandler = renderHook(() => useAlertComments({ canComment: true, onAddAlertComment }));
    const semHandler = renderHook(() => useAlertComments({ canComment: true }));

    act(() => comHandler.result.current.onChange("a1", "   "));
    await act(async () => comHandler.result.current.onSubmit("a1"));
    await act(async () => comHandler.result.current.onSubmit("outro"));
    act(() => semHandler.result.current.onChange("a1", "texto"));
    await act(async () => semHandler.result.current.onSubmit("a1"));

    expect(onAddAlertComment).not.toHaveBeenCalled();
    expect(semHandler.result.current.drafts.a1).toBe("texto");
  });

  it("mantém o rascunho quando o envio falha", async () => {
    const onAddAlertComment = vi.fn().mockRejectedValue(new Error("falhou"));
    const { result } = renderHook(() => useAlertComments({ canComment: true, onAddAlertComment }));

    act(() => result.current.onChange("a1", "texto"));
    await act(async () => {
      await result.current.onSubmit("a1").catch(() => {});
    });

    expect(result.current.drafts.a1).toBe("texto");
  });
});
