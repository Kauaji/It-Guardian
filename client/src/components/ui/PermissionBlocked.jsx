import { ShieldCheck } from "lucide-react";

export default function PermissionBlocked() {
  return (
    <section className="permission-blocked-panel">
      <ShieldCheck size={26} />
      <h2>Você não possui permissão para acessar este módulo.</h2>
      <p>Peça para um administrador liberar o acesso necessário nas Configurações Gerais.</p>
    </section>
  );
}
