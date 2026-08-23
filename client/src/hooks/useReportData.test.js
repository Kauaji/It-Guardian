import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../api.js", () => ({
  fetchReportPreview: vi.fn()
}));

import { fetchReportPreview } from "../api.js";
import { useReportData } from "./useReportData.js";

afterEach(() => {
  vi.clearAllMocks();
});

describe("useReportData", () => {
  it("carrega o preview quando token/tipo/permissao estao presentes", async () => {
    fetchReportPreview.mockResolvedValue({ summary: {}, rows: [{ id: "1" }], warnings: [] });

    const { result } = renderHook(() =>
      useReportData({ token: "tok", type: "sla", filters: { startDate: "2026-08-01" }, canView: true })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.rows).toHaveLength(1);
    expect(result.current.error).toBe("");
    expect(fetchReportPreview).toHaveBeenCalledWith("tok", "sla", { startDate: "2026-08-01" });
  });

  it("nao chama a API quando canView e falso, e nao guarda dado velho", async () => {
    const { result } = renderHook(() =>
      useReportData({ token: "tok", type: "scripts", filters: {}, canView: false })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchReportPreview).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("expõe a mensagem de erro e notifica quando a API falha", async () => {
    fetchReportPreview.mockRejectedValue(new Error("falha ao carregar"));
    const notify = vi.fn();

    const { result } = renderHook(() =>
      useReportData({ token: "tok", type: "alerts", filters: {}, canView: true, notify })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("falha ao carregar");
    expect(notify).toHaveBeenCalledWith("falha ao carregar", "danger");
  });

  it("reload dispara uma nova chamada com os mesmos parametros", async () => {
    fetchReportPreview.mockResolvedValue({ summary: {}, rows: [], warnings: [] });

    const { result } = renderHook(() =>
      useReportData({ token: "tok", type: "assets", filters: {}, canView: true })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchReportPreview.mockClear();

    await act(async () => {
      await result.current.reload();
    });

    expect(fetchReportPreview).toHaveBeenCalledTimes(1);
  });
});
