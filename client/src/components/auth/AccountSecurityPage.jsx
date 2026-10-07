import { useEffect, useRef, useState } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { fetchMe } from "../../api/identityApi.js";
import MfaSection from "./MfaSection.jsx";
import PasswordSection from "./PasswordSection.jsx";
import SessionsSection from "./SessionsSection.jsx";

// Pagina /conta/seguranca: senha, verificacao em duas etapas e sessoes.
export default function AccountSecurityPage() {
  const { handleAuth, notify, token, user } = useAppSession();
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function passwordChanged(session) {
    // A troca revoga as outras sessoes e abre uma nova para este dispositivo.
    handleAuth({ token: session.token, user: session.user });
    setSessionsVersion((version) => version + 1);
    notify("Senha alterada. Os outros dispositivos foram desconectados.", "ok");
  }

  async function refreshUser() {
    const fresh = await fetchMe(token);
    handleAuth({ token: fresh.token || token, user: fresh.user });
  }

  return (
    <div className="account-page">
      <header className="account-header">
        <h2 ref={headingRef} tabIndex={-1}>
          Segurança da conta
        </h2>
        <p>
          {user?.name} · {user?.email}
        </p>
      </header>
      <PasswordSection token={token} user={user} onChanged={passwordChanged} />
      <MfaSection token={token} user={user} notify={notify} onUserChanged={refreshUser} />
      <SessionsSection token={token} notify={notify} reloadKey={sessionsVersion} />
    </div>
  );
}
