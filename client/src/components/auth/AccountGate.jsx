import { Suspense, lazy, useEffect, useState } from "react";
import { ACCOUNT_RESTRICTED_EVENT } from "../../authSession.js";
import { fetchMe, fetchMfaStatus } from "../../api/identityApi.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import ViewLoadingState from "../ui/ViewLoadingState.jsx";
// Telas de bloqueio raras: carregadas sob demanda.
const ForcedPasswordChange = lazy(() => import("./ForcedPasswordChange.jsx"));
const MfaEnrollmentGate = lazy(() => import("./MfaEnrollmentGate.jsx"));

function isAdminUser(user) {
  return Boolean(user?.isAdmin || user?.role === "admin");
}

// Decide se o servidor vai exigir cadastro de MFA deste administrador. A
// pergunta so e feita quando o usuario e admin e `mfaEnabled === false`
// explicito (o backend sempre envia o booleano), com um unico GET leve a
// /auth/mfa/status, rota liberada mesmo para contas restritas.
function useMfaEnrollmentRequirement({ token, user, active }) {
  const [state, setState] = useState({ userId: null, required: false });
  const needsCheck = active && isAdminUser(user) && user.mfaEnabled === false;

  useEffect(() => {
    if (!needsCheck) return undefined;
    let current = true;
    fetchMfaStatus(token)
      .then((status) => current && setState({ userId: user.id, required: Boolean(status.requiredForAdmins && !status.enabled) }))
      .catch(() => current && setState({ userId: user.id, required: false }));
    return () => {
      current = false;
    };
  }, [needsCheck, token, user.id]);

  // Qualquer chamada que o servidor recuse com MFA_ENROLLMENT_REQUIRED
  // (evento global) tambem liga o bloqueio.
  useEffect(() => {
    function onRestricted(event) {
      if (event.detail?.code === "MFA_ENROLLMENT_REQUIRED") setState({ userId: user.id, required: true });
    }
    window.addEventListener(ACCOUNT_RESTRICTED_EVENT, onRestricted);
    return () => window.removeEventListener(ACCOUNT_RESTRICTED_EVENT, onRestricted);
  }, [user.id]);

  const resolved = state.userId === user.id;
  return {
    checking: needsCheck && !resolved,
    required: resolved && state.required && user.mfaEnabled !== true,
    clear: () => setState({ userId: user.id, required: false })
  };
}

// Porteiro do app autenticado: enquanto a conta tiver pendencia obrigatoria
// (trocar senha ou cadastrar MFA) renderiza SO a tela bloqueante, sem montar
// nenhuma rota nem carregar dados do app.
export default function AccountGate({ children }) {
  const { handleAuth, notify, signOut, token, user } = useAppSession();
  const mustChange = user.mustChangePassword === true;
  const enrollment = useMfaEnrollmentRequirement({ token, user, active: !mustChange });

  // Um 403 PASSWORD_CHANGE_REQUIRED vindo de qualquer chamada vira bloqueio.
  useEffect(() => {
    function onRestricted(event) {
      if (event.detail?.code === "PASSWORD_CHANGE_REQUIRED" && !user.mustChangePassword) {
        handleAuth({ token, user: { ...user, mustChangePassword: true } });
      }
    }
    window.addEventListener(ACCOUNT_RESTRICTED_EVENT, onRestricted);
    return () => window.removeEventListener(ACCOUNT_RESTRICTED_EVENT, onRestricted);
  }, [handleAuth, token, user]);

  if (mustChange) {
    return (
      <Suspense fallback={<ViewLoadingState />}>
      <ForcedPasswordChange
        token={token}
        user={user}
        onSignOut={signOut}
        onChanged={(session) => {
          handleAuth({ token: session.token, user: session.user });
          notify("Senha alterada com sucesso.", "ok");
        }}
      />
      </Suspense>
    );
  }

  if (enrollment.checking) return <ViewLoadingState />;

  if (enrollment.required) {
    return (
      <Suspense fallback={<ViewLoadingState />}>
      <MfaEnrollmentGate
        token={token}
        onSignOut={signOut}
        onComplete={async () => {
          // Se a releitura falhar, o MFA ja esta ativo no servidor: segue com o usuario local.
          const fresh = await fetchMe(token).catch(() => ({ user: { ...user, mfaEnabled: true } }));
          enrollment.clear();
          handleAuth({ token: fresh.token || token, user: fresh.user });
          notify("Verificação em duas etapas ativada.", "ok");
        }}
      />
      </Suspense>
    );
  }

  return children;
}
