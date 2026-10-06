// Solicitante (tecnico da lista ou nome livre quando e OS de terceiros) e a chave de terceiros.
export default function RequesterFields({ form, technicians, thirdPartyRequester, updateField, onToggleThirdParty }) {
  return (
    <>
      <label>
        Solicitante
        {thirdPartyRequester ? (
          <input
            value={form.requesterName}
            onChange={(event) => updateField("requesterName", event.target.value)}
            placeholder="Nome do solicitante real"
          />
        ) : technicians.length ? (
          <select value={form.requesterName} onChange={(event) => updateField("requesterName", event.target.value)}>
            <option value="">Selecione o técnico</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.name}>{technician.name}</option>
            ))}
          </select>
        ) : (
          <div className="service-order-inline-empty">Não existem técnicos cadastrados.</div>
        )}
      </label>

      <label className="service-order-third-party-field">
        <span className="service-order-third-party-check">
          <input
            type="checkbox"
            checked={thirdPartyRequester}
            onChange={(event) => onToggleThirdParty(event.target.checked)}
          />
          <span>É uma OS de terceiros?</span>
        </span>
      </label>
    </>
  );
}
