import { Monitor } from "lucide-react";
import PublicSupportMachineSummary from "../PublicSupportMachineSummary.jsx";

function ScopeChoice({ scope, checked, onSelect, children }) {
  return (
    <label className={checked ? "selected" : ""}>
      <input type="radio" name="machineScope" checked={checked} onChange={() => onSelect(scope)} />
      {children}
    </label>
  );
}

function MachineFields({ form, updateField }) {
  return (
    <div className="public-support-machine-grid">
      <label>
        Nome da máquina
        <input
          value={form.machineName}
          onChange={(event) => updateField("machineName", event.target.value)}
          placeholder="Ex: PC-RECEPCAO-01"
        />
      </label>
      <label>
        Patrimônio
        <input
          value={form.assetTag}
          onChange={(event) => updateField("assetTag", event.target.value)}
          placeholder="Número de patrimônio, se souber"
        />
      </label>
      <label>
        Localização
        <input
          value={form.location}
          onChange={(event) => updateField("location", event.target.value)}
          placeholder="Setor, sala ou andar"
        />
      </label>
    </div>
  );
}

export default function PublicSupportMachineSection({
  form,
  deviceToken,
  machineContextLoading,
  machineContextError,
  machine,
  updateField
}) {
  const selectScope = (scope) => updateField("machineScope", scope);
  return (
    <section className="public-support-machine public-support-wide">
      <div className="public-support-section-title">
        <Monitor size={18} />
        <div>
          <strong>Máquina relacionada</strong>
        </div>
      </div>

      <PublicSupportMachineSummary
        deviceToken={deviceToken}
        machineContextLoading={machineContextLoading}
        machineContextError={machineContextError}
        machine={machine}
      />

      <div className="public-support-choices">
        <ScopeChoice scope="mine" checked={form.machineScope === "mine"} onSelect={selectScope}>
          O problema é na minha máquina
          {form.machineScope === "mine" && form.assetId ? (
            <small>Identificada: {form.machineName}</small>
          ) : null}
        </ScopeChoice>
        <ScopeChoice scope="other" checked={form.machineScope === "other"} onSelect={selectScope}>
          O problema é em outra máquina/equipamento
        </ScopeChoice>
      </div>

      {form.machineScope && <MachineFields form={form} updateField={updateField} />}
    </section>
  );
}
