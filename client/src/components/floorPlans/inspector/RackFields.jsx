import { Plus } from "lucide-react";
import { RACK_SWITCH_DEFAULT_PORTS, buildMetadataPatch, buildRackSwitchPatch } from "../utils/inspectorPatches.js";

function SwitchPortsFields({ entity, onChangeSelected }) {
  const totalPorts = Number(entity.metadata?.switchTotalPorts || RACK_SWITCH_DEFAULT_PORTS);
  return (
    <>
      <div className="floor-plan-inspector-grid">
        <label>
          Portas totais
          <input
            type="number"
            min="1"
            max="96"
            value={totalPorts}
            onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { switchTotalPorts: Number(event.target.value) }))}
          />
        </label>
        <label>
          Funcionando
          <input
            type="number"
            min="0"
            max={totalPorts}
            value={Number(entity.metadata?.switchWorkingPorts ?? entity.metadata?.switchTotalPorts ?? RACK_SWITCH_DEFAULT_PORTS)}
            onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { switchWorkingPorts: Number(event.target.value) }))}
          />
        </label>
      </div>
      <button
        type="button"
        className="secondary-action compact-action"
        onClick={() => onChangeSelected(buildRackSwitchPatch(entity, false))}
      >
        Remover switch
      </button>
    </>
  );
}

/** Configuracao do switch instalado em um rack (portas totais e funcionando). */
export default function RackFields({ entity, onChangeSelected }) {
  const installed = Boolean(entity.metadata?.switchInstalled);
  return (
    <section className="floor-plan-rack-config">
      <header>
        <strong>Switch no rack</strong>
        {!installed ? (
          <button
            type="button"
            className="icon-button"
            title="Adicionar switch"
            onClick={() => onChangeSelected(buildRackSwitchPatch(entity, true))}
          >
            <Plus size={17} />
          </button>
        ) : null}
      </header>
      {installed ? (
        <SwitchPortsFields entity={entity} onChangeSelected={onChangeSelected} />
      ) : (
        <small>Adicione um switch para controlar as portas do rack.</small>
      )}
    </section>
  );
}
