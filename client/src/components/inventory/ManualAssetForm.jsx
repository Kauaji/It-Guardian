import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { assetTypeOptions } from "./assetTypes.js";

const initialForm = {
  name: "",
  type: "printer",
  brand: "",
  model: "",
  assetTag: "",
  ip: "",
  macAddress: "",
  hostname: "",
  identificationMode: "fixed_ip",
  location: "",
  notes: ""
};

export default function ManualAssetForm({ open, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (open) setForm(initialForm);
  }, [open]);

  if (!open) return null;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="modal-backdrop asset-modal-backdrop" role="presentation">
      <section className="manual-asset-modal" role="dialog" aria-modal="true" aria-label="Novo ativo de rede">
        <header className="asset-modal-header">
          <div>
            <span className="asset-eyebrow">Cadastro manual</span>
            <h2>Novo ativo de rede</h2>
            <p>Equipamentos com IP proprio, monitorados por ping.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        <form className="manual-asset-form" onSubmit={submit}>
          <label>
            Nome
            <input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="IMP-FIN-01" />
          </label>
          <label>
            Tipo do aparelho
            <select required value={form.type} onChange={(event) => update("type", event.target.value)}>
              {assetTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Marca
            <input required value={form.brand} onChange={(event) => update("brand", event.target.value)} placeholder="Brother" />
          </label>
          <label>
            Modelo
            <input required value={form.model} onChange={(event) => update("model", event.target.value)} placeholder="MFC-L8900CDW" />
          </label>
          <label>
            Patrimônio
            <input required value={form.assetTag} onChange={(event) => update("assetTag", event.target.value)} placeholder="NET-IMP-0021" />
          </label>
          <label>
            IP
            <input required value={form.ip} onChange={(event) => update("ip", event.target.value)} placeholder="10.10.6.41" />
          </label>
          <label>
            MAC Address
            <input value={form.macAddress} onChange={(event) => update("macAddress", event.target.value)} placeholder="00:11:22:33:44:55" />
          </label>
          <label>
            Hostname
            <input value={form.hostname} onChange={(event) => update("hostname", event.target.value)} placeholder="imp-fin-01" />
          </label>
          <label>
            Identificacao
            <select value={form.identificationMode} onChange={(event) => update("identificationMode", event.target.value)}>
              <option value="fixed_ip">IP fixo/manual</option>
              <option value="mac_hostname">MAC/hostname se IP mudar</option>
              <option value="hostname">Hostname</option>
            </select>
          </label>
          <label>
            Localizacao
            <input value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="Financeiro" />
          </label>
          <label className="manual-asset-wide">
            Observações
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Reserva DHCP recomendada, sala, responsavel..." />
          </label>

          <footer className="manual-asset-actions">
            <button type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-action compact-action" disabled={saving}>
              {saving ? "Salvando..." : "Criar ativo"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
