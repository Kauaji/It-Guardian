import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAuthSession, logoutSession } from "../api.js";
import { clearAuthSession, readAuthSession, writeAuthSession } from "../authSession.js";
import {
  applyStoredGeneralPreferences,
  clearRuntimeAppearancePreferences
} from "../components/settings/GeneralSettingsModal.jsx";

const themeKey = "it_guardian_theme";

export function useAppSessionController({ isPublicSupportPath, assetId }) {
  const initialAuthSession = useMemo(() => readAuthSession(), []);
  const [token, setToken] = useState(initialAuthSession.token);
  const [user, setUser] = useState(initialAuthSession.user);
  const [authLoading, setAuthLoading] = useState(!isPublicSupportPath && !assetId);
  const [toast, setToast] = useState({ message: "", tone: "ok" });
  const [theme, setTheme] = useState(() => localStorage.getItem(themeKey) || "light");

  const notify = useCallback((message, tone = "ok") => {
    setToast({ message, tone });
  }, []);

  const clearToast = useCallback(() => {
    setToast({ message: "", tone: "ok" });
  }, []);

  const handleAuth = useCallback((data) => {
    setToken(data.token);
    setUser(data.user);
  }, []);

  const handleLogout = useCallback(() => {
    clearAuthSession();
    if (token) {
      logoutSession(token).catch(() => {});
    }
    setToken(null);
    setUser(null);
  }, [token]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    if (isPublicSupportPath || assetId) {
      setAuthLoading(false);
      return undefined;
    }

    let active = true;
    fetchAuthSession()
      .then((session) => {
        if (!active) return;
        writeAuthSession();
        setToken(session.token);
        setUser(session.user);
      })
      .catch(() => {
        if (!active) return;
        clearAuthSession();
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, [assetId, isPublicSupportPath]);

  useEffect(() => {
    if (isPublicSupportPath || !token || !user) {
      document.documentElement.dataset.theme = "light";
      clearRuntimeAppearancePreferences();
      return;
    }

    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeKey, theme);
    applyStoredGeneralPreferences();
  }, [isPublicSupportPath, theme, token, user]);

  useEffect(() => {
    function handleAuthExpired() {
      clearAuthSession();
      setToken(null);
      setUser(null);
      notify("Sessao expirada. Faca login novamente.", "danger");
    }

    window.addEventListener("it-guardian:auth-expired", handleAuthExpired);
    return () => window.removeEventListener("it-guardian:auth-expired", handleAuthExpired);
  }, [notify]);

  return {
    authLoading,
    clearToast,
    handleAuth,
    logout: handleLogout,
    notify,
    theme,
    toast,
    token,
    toggleTheme,
    user
  };
}
