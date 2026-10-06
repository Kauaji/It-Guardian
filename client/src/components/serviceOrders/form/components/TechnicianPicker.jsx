export default function TechnicianPicker({ technicians, selectedNames, onToggle }) {
  return (
    <fieldset className="service-order-technician-picker service-order-wide">
      <legend>Técnicos responsáveis</legend>
      <p>Selecione um ou mais técnicos para atender esta ordem.</p>
      {technicians.length ? (
        <div>
          {technicians.map((technician) => {
            const checked = selectedNames.includes(technician.name);
            return (
              <label key={technician.id} className={checked ? "selected" : ""}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(technician.name)} />
                <span>{technician.name}</span>
                {technician.specialty ? <small>{technician.specialty}</small> : null}
              </label>
            );
          })}
        </div>
      ) : <div className="service-order-inline-empty">Não existem técnicos cadastrados.</div>}
    </fieldset>
  );
}
