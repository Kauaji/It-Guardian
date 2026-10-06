import { Clipboard, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";

const formFields = [
  { name: "displayName", label: "Nome de exibição", maxLength: 120, placeholder: "Cliente principal" },
  { name: "organizationName", label: "Organização", maxLength: 160, placeholder: "Empresa" },
  { name: "planName", label: "Plano", maxLength: 80 },
  { name: "activationLimit", label: "Limite de computadores", type: "number", min: "1", max: "100000" },
  { name: "expiresAt", label: "Expira em", type: "date" }
];

export function ProductKeyForm({ form, setForm, busy, onSubmit }) {
  return (
    <form className="admin-form-card cloud-key-form" onSubmit={onSubmit}>
      <div className="admin-form-header">
        <strong><KeyRound size={17} /> Nova chave</strong>
        <span className="cloud-security-note"><ShieldCheck size={15} /> SHA-256</span>
      </div>
      <div className="admin-form-grid">
        {formFields.map(({ name, label, ...inputProps }) => (
          <label key={name}>
            {label}
            <input
              {...inputProps}
              value={form[name]}
              onChange={(event) => setForm((current) => ({
                ...current,
                [name]: event.target.value
              }))}
            />
          </label>
        ))}
      </div>
      <button type="submit" className="primary-action compact-action" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={16} /> : <KeyRound size={16} />}
        Gerar chave
      </button>
    </form>
  );
}

export function KeyRevealCard({ createdKey, onCopy }) {
  return (
    <section className={`cloud-key-reveal${createdKey ? " visible" : ""}`}>
      <ShieldCheck size={21} />
      <div>
        <strong>{createdKey ? "Chave criada" : "Exibição única"}</strong>
        <span>
          {createdKey
            ? createdKey.warning
            : "A chave completa aparece aqui uma única vez e nunca é armazenada em texto puro."}
        </span>
      </div>
      {createdKey && (
        <>
          <code>{createdKey.value}</code>
          <button type="button" className="secondary-action compact-action" onClick={onCopy}>
            <Clipboard size={16} />
            Copiar
          </button>
        </>
      )}
    </section>
  );
}
