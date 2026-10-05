import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppSessionProvider } from "../context/AppSessionContext.jsx";

// Erro de API no formato que identityApi lanca (so os campos que a UI le).
export function apiError(code, statusCode = 401, message = "Mensagem do servidor", details) {
  return Object.assign(new Error(message), { code, statusCode, details: details || [] });
}

export const baseUser = {
  id: "u1",
  name: "Ana Admin",
  email: "ana@empresa.com",
  role: "admin",
  isAdmin: true,
  mfaEnabled: true,
  mustChangePassword: false
};

export function renderWithSession(ui, { user = baseUser, overrides = {}, path = "/" } = {}) {
  const session = {
    token: "tok-1",
    user,
    notify: vi.fn(),
    handleAuth: vi.fn(),
    signOut: vi.fn(),
    logout: vi.fn(),
    theme: "light",
    toggleTheme: vi.fn(),
    ...overrides
  };
  return { session, tree: <MemoryRouter initialEntries={[path]}><AppSessionProvider value={session}>{ui}</AppSessionProvider></MemoryRouter> };
}
