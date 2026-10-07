import { Download } from "lucide-react";

export default function CloudAdminHeader({ installerUrl }) {
  return (
    <header className="cloud-admin-heading">
      <div>
        <strong>Cloud e coletores</strong>
        <span>Licenciamento, computadores ativados e fontes opcionais de inventário.</span>
      </div>
      {installerUrl ? (
        <a className="secondary-action compact-action cloud-installer-action" href={installerUrl} download>
          <Download size={16} />
          Baixar instalador
        </a>
      ) : (
        <button
          type="button"
          className="secondary-action compact-action cloud-installer-action"
          disabled
          title="Defina VITE_COLLECTOR_INSTALLER_URL no build do frontend."
        >
          <Download size={16} />
          Instalador indisponível
        </button>
      )}
    </header>
  );
}
