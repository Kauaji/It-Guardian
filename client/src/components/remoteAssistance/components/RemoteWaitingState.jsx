// Estado de espera dentro da area da tela (consentimento, negociacao, imagem).
export default function RemoteWaitingState({ icon, title, children }) {
  return (
    <div className="remote-assistance-waiting">
      {icon}
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  );
}
