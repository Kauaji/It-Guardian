import ChangePasswordForm from "./ChangePasswordForm.jsx";

export default function PasswordSection({ token, user, onChanged }) {
  return (
    <section className="account-section" aria-labelledby="password-section-title">
      <h3 id="password-section-title">Senha</h3>
      <p className="auth-step-text">
        Ao trocar a senha, os outros dispositivos conectados à sua conta são desconectados. Esta sessão continua ativa.
      </p>
      <ChangePasswordForm token={token} user={user} onChanged={onChanged} />
    </section>
  );
}
