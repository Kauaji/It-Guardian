import { X } from "lucide-react";

export default function RemoteDialogHeader({ displayName, asset, onClose }) {
  return (
    <header className="remote-assistance-header">
      <div>
        <span className="asset-eyebrow">Assistencia Remota</span>
        <h2>{displayName}</h2>
        <p>{asset.hostname || asset.name} - {asset.ip || "IP nao informado"}</p>
      </div>
      <button type="button" className="icon-button" onClick={onClose} title="Fechar">
        <X size={18} />
      </button>
    </header>
  );
}
