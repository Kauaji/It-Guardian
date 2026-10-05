import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAuthSession, logoutSession } from "../api.js";
import {
  AUTH_EXPIRED_EVENT,
  SESSION_EXPIRED_MESSAGE,
  clearAuthSession,
  readAuthSession,
  writeAuthSession
} from "../authSession.js";
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

  // Evita avisar "sessao expirada" por uma resposta 401 atrasada que chega
  // depois de a pessoa ja ter saido de proposito (e do app ja estar no login).
  const authenticatedRef = useRef(false);
  authenticatedRef.current = Boolean(token && user);

  useEffect(() => {
    function handleAuthExpired() {
      if (!authenticatedRef.current) return;
      clearAuthSession();
      setToken(null);
      setUser(null);
      notify(SESSION_EXPIRED_MESSAGE, "danger");
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
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
