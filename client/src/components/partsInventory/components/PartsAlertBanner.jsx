import { ExternalLink, ShieldAlert } from "lucide-react";

export default function PartsAlertBanner({ count, onReview }) {
  return (
    <button type="button" className="parts-alert-banner" onClick={onReview}>
      <ShieldAlert />
      <span>
        <strong>{count} incongruência(s) aguardando conferência</strong>Abra para ver a peça divergente e localizar a máquina
        correspondente.
      </span>
      <span>
        Revisar <ExternalLink size={13} />
      </span>
    </button>
  );
}
