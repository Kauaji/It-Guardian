import { Search } from "lucide-react";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";
import PreventiveDeviceRow from "./PreventiveDeviceRow.jsx";

function SelectorToolbar({ preventive }) {
  const count = preventive.selection.assets.size;

  return (
    <div className="preventive-toolbar">
      <label className="compact-search preventive-search">
        <Search size={16} />
        <input
          value={preventive.search}
          onChange={(event) => preventive.setSearch(event.target.value)}
          placeholder="Buscar máquina, grupo, segmento ou ambiente"
        />
      </label>
      <select
        className="preventive-status-filter"
        value={preventive.filter}
        onChange={(event) => preventive.setFilter(event.target.value)}
        aria-label="Filtrar status preventivo"
      >
        <option value="all">Todas</option>
        <option value="no_preventive">Sem preventiva</option>
        <option value="overdue">Vencida</option>
        <option value="up_to_date">Em dia</option>
        <option value="alerts">Com avisos</option>
        <option value="maintenance">Em manutenção</option>
        <option value="backup">Backup</option>
      </select>
      <div className="preventive-plan-summary">
        <strong>{count}</strong>
        <span>{count === 1 ? "máquina selecionada" : "máquinas selecionadas"}</span>
      </div>
    </div>
  );
}

function DeviceGroup({ group, preventive, dueDays }) {
  const { perms } = useAlertCenterView();
  const { selection } = preventive;
  const assetIds = group.devices.map((item) => item.device.id);
  const selectedCount = assetIds.filter((assetId) => selection.assets.has(assetId)).length;

  return (
    <section className="preventive-device-group">
      <header>
        <div>
          <strong>
            {group.groupName} • {group.segmentName}
          </strong>
          <small>
            {group.devices.length} {group.devices.length === 1 ? "máquina" : "máquinas"} neste segmento
          </small>
        </div>
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={!perms.canCreatePreventivePlans}
          onClick={() => selection.toggleSegment(assetIds)}
        >
          {selectedCount === assetIds.length ? "Remover segmento" : "Selecionar segmento"}
        </button>
      </header>

      <div className="preventive-device-list">
        {group.devices.map((item) => (
          <PreventiveDeviceRow
            key={item.device.id}
            item={item}
            dueDays={dueDays}
            selected={selection.assets.has(item.device.id)}
            disabled={!perms.canCreatePreventivePlans}
            onToggle={selection.toggleAsset}
          />
        ))}
      </div>
    </section>
  );
}

// Etapa 1: busca, filtro e lista das maquinas agrupadas por segmento.
export default function PreventiveDeviceSelector({ preventive, dueDays }) {
  return (
    <section className="preventive-device-groups" aria-label="Máquinas para preventiva">
      <div className="preventive-step-header">
        <span>Etapa 1</span>
        <div>
          <strong>Selecionar máquinas</strong>
        </div>
      </div>
      <SelectorToolbar preventive={preventive} />
      <div className="preventive-group-list">
        {preventive.groups.map((group) => (
          <DeviceGroup key={group.key} group={group} preventive={preventive} dueDays={dueDays} />
        ))}

        {!preventive.groups.length && <p className="empty">Nenhuma máquina encontrada para os filtros atuais.</p>}
      </div>
    </section>
  );
}
