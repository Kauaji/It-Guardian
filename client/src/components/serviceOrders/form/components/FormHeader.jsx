import { X } from "lucide-react";

export default function FormHeader({ helperText, onClose }) {
  return (
    <header>
      <div>
        <h2 id="service-order-form-title">Nova Ordem de Serviço</h2>
        <p>{helperText}</p>
      </div>
      <button type="button" className="icon-button" onClick={onClose} title="Fechar">
        <X size={18} />
      </button>
    </header>
  );
}
