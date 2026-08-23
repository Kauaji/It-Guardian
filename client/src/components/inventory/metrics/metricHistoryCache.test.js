import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cacheKey, clearMetricHistoryCache, getCached, setCached } from "./metricHistoryCache.js";

beforeEach(() => {
  clearMetricHistoryCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("metricHistoryCache", () => {
  it("devolve o valor guardado dentro do TTL", () => {
    const key = cacheKey("device-1", "cpu", "24h");
    setCached(key, { summary: { current: 10 } });
    expect(getCached(key)).toEqual({ summary: { current: 10 } });
  });

  it("expira apos o TTL e devolve null", () => {
    vi.useFakeTimers();
    const key = cacheKey("device-1", "cpu", "24h");
    setCached(key, { summary: { current: 10 } });

    vi.advanceTimersByTime(21_000);

    expect(getCached(key)).toBeNull();
  });

  it("chaves diferentes nao colidem", () => {
    setCached(cacheKey("device-1", "cpu", "24h"), { summary: { current: 1 } });
    setCached(cacheKey("device-1", "ram", "24h"), { summary: { current: 2 } });
    setCached(cacheKey("device-2", "cpu", "24h"), { summary: { current: 3 } });

    expect(getCached(cacheKey("device-1", "cpu", "24h")).summary.current).toBe(1);
    expect(getCached(cacheKey("device-1", "ram", "24h")).summary.current).toBe(2);
    expect(getCached(cacheKey("device-2", "cpu", "24h")).summary.current).toBe(3);
  });

  it("chave desconhecida devolve null", () => {
    expect(getCached(cacheKey("device-x", "disk", "7d"))).toBeNull();
  });
});
