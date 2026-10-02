import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppSessionProvider } from "../context/AppSessionContext.jsx";
import { DataProvider } from "../app/context/workspaceContexts.js";

// Utilitarios dos testes de client/src/app: sessao falsa, "store" que imita o
// setState do React (aceita valor ou funcao) e roteador em memoria.

export const adminUser = { id: "user-1", name: "Ana Admin", role: "admin" };

export function createSession(overrides = {}) {
  return {
    token: "token-1",
    user: adminUser,
    notify: vi.fn(),
    logout: vi.fn(),
    signOut: vi.fn(),
    theme: "light",
    toggleTheme: vi.fn(),
    ...overrides
  };
}

export function sessionWrapper(session) {
  return function SessionWrapper({ children }) {
    return <AppSessionProvider value={session}>{children}</AppSessionProvider>;
  };
}

export function routerWrapper(initialEntries = ["/"], session = null) {
  return function RouterWrapper({ children }) {
    const content = <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
    return session ? <AppSessionProvider value={session}>{content}</AppSessionProvider> : content;
  };
}

// Imita useState fora do React: `set` aceita valor ou updater e guarda o
// resultado em `get()`, permitindo verificar o que o hook gravaria.
export function createStore(initial) {
  let value = initial;
  const set = vi.fn((next) => {
    value = typeof next === "function" ? next(value) : next;
  });
  return { get: () => value, set };
}

// "Dados do servidor" falsos: arrays + setters ligados a stores.
export function createData(initial = {}) {
  const stores = {
    allDevices: createStore(initial.allDevices || []),
    devices: createStore(initial.devices || []),
    segmentGroups: createStore(initial.segmentGroups || []),
    segments: createStore(initial.segments || []),
    serviceOrders: createStore(initial.serviceOrders || [])
  };

  const data = {
    allDevices: stores.allDevices.get(),
    devices: stores.devices.get(),
    segmentGroups: stores.segmentGroups.get(),
    segments: stores.segments.get(),
    serviceOrders: stores.serviceOrders.get(),
    systemMode: "local",
    loadData: vi.fn().mockResolvedValue(undefined),
    setAllDevices: stores.allDevices.set,
    setDevices: stores.devices.set,
    setSegmentGroups: stores.segmentGroups.set,
    setSegments: stores.segments.set,
    setSelectedDevice: vi.fn(),
    setServiceOrders: stores.serviceOrders.set,
    ...initial.overrides
  };

  return { data, stores };
}

// Envolve os hooks que leem a fatia de dados do workspace (alertas, scripts,
// preventivas) com sessao falsa + DataProvider.
export function dataSliceWrapper(session, dataValue) {
  return function DataSliceWrapper({ children }) {
    return (
      <AppSessionProvider value={session}>
        <DataProvider value={dataValue}>{children}</DataProvider>
      </AppSessionProvider>
    );
  };
}
