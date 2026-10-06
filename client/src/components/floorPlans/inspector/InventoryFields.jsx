import { Link2, Monitor, X } from "lucide-react";
import { getCatalogItem } from "../floorPlanCatalog.js";
import { filterCompatibleSegments } from "../utils/infrastructure.js";
import { buildGroupChangePatch, buildMetadataPatch } from "../utils/inspectorPatches.js";
import { deviceLabel, getDeviceStatusTone, getDeviceTags } from "../utils/planPresentation.js";

const CRITICALITY_OPTIONS = [
  ["low", "Baixa"],
  ["normal", "Normal"],
  ["high", "Alta"],
  ["critical", "Crítica"]
];

const MANUAL_STATUS_OPTIONS = [
  ["online", "Online"],
  ["offline", "Offline"],
  ["warning", "Atenção"],
  ["critical", "Crítico"],
  ["no_data", "Sem dados"]
];

function AssetSummary({ entity, linkedDevice }) {
  const AssetIcon = getCatalogItem(entity.objectType)?.icon || Monitor;
  const statusTone = getDeviceStatusTone(linkedDevice?.status);
  return (
    <div className="floor-plan-asset-summary">
      <span className="floor-plan-asset-icon">
        <AssetIcon size={27} />
      </span>
      <span>
        <strong className="floor-plan-asset-name">
          {linkedDevice ? deviceLabel(linkedDevice) : entity.label || "Ativo sem vínculo"}
          {linkedDevice ? (
            <i
              className={`floor-plan-asset-status-dot ${statusTone}`}
              title={`Status ${linkedDevice.status || "não informado"}`}
              aria-label={`Status ${linkedDevice.status || "não informado"}`}
            />
          ) : null}
        </strong>
        {!linkedDevice ? <small>Sem vínculo com o inventário</small> : null}
      </span>
    </div>
  );
}

function GroupSegmentFields({ entity, groups, segments, onChangeSelected }) {
  const semanticSegments = entity.groupId ? filterCompatibleSegments(segments, entity.groupId) : segments;
  return (
    <div className="floor-plan-inspector-grid">
      <label>
        Grupo
        <select
          value={entity.groupId || ""}
          onChange={(event) => onChangeSelected(buildGroupChangePatch(entity, event.target.value || null, segments))}
        >
          <option value="">Sem grupo</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Segmento
        <select value={entity.segmentId || ""} onChange={(event) => onChangeSelected({ segmentId: event.target.value || null })}>
          <option value="">Sem segmento</option>
          {semanticSegments.map((segment) => (
            <option key={segment.id} value={segment.id}>
              {segment.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function LinkAction({ entity, linkedDevice, canLink, showLinkPicker, onTogglePicker, onUnlink }) {
  if (linkedDevice) {
    return (
      <button className="floor-plan-unlink-action" type="button" disabled={!canLink} onClick={() => onUnlink(entity.id, "")}>
        <X size={16} />
        Desvincular máquina
      </button>
    );
  }
  return (
    <button
      className="floor-plan-correlate-action"
      type="button"
      disabled={!canLink}
      aria-expanded={showLinkPicker}
      onClick={onTogglePicker}
    >
      <Link2 size={16} />
      Correlacionar máquina
    </button>
  );
}

/** Campos do ativo de inventario: nome, descricao, grupo, criticidade, status e (des)vinculo. */
export function InventoryAssetFields({ entity, linkedDevice, inventory, showLinkPicker, onTogglePicker, onChangeSelected }) {
  const { groups, segments, permissions, onLinkObject } = inventory;
  return (
    <>
      <AssetSummary entity={entity} linkedDevice={linkedDevice} />
      <label>
        Nome no mapa
        <input value={entity.label || ""} onChange={(event) => onChangeSelected({ label: event.target.value })} />
      </label>
      <label>
        Descrição técnica
        <textarea
          rows="2"
          value={entity.metadata?.description || ""}
          placeholder="Função, localização ou observação útil"
          onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { description: event.target.value }))}
        />
      </label>
      <GroupSegmentFields entity={entity} groups={groups} segments={segments} onChangeSelected={onChangeSelected} />
      <label>
        Criticidade
        <select
          value={entity.metadata?.criticality || "normal"}
          onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { criticality: event.target.value }))}
        >
          {CRITICALITY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {!linkedDevice ? (
        <label>
          Status manual
          <select
            value={entity.metadata?.manualStatus || "no_data"}
            onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { manualStatus: event.target.value }))}
          >
            {MANUAL_STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <LinkAction
        entity={entity}
        linkedDevice={linkedDevice}
        canLink={permissions.linkInventory}
        showLinkPicker={showLinkPicker}
        onTogglePicker={onTogglePicker}
        onUnlink={onLinkObject}
      />
    </>
  );
}

/** Seletor de maquina do inventario exibido ao correlacionar um ativo. */
export function InventoryLinkPicker({ entity, devices, onLinkObject, onDone }) {
  return (
    <label>
      Máquina do inventário
      <select
        id="floor-plan-inventory-link"
        value=""
        onChange={(event) => {
          onLinkObject(entity.id, event.target.value);
          onDone();
        }}
      >
        <option value="">Selecione uma máquina</option>
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {deviceLabel(device)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Tomada, ponto de rede, tags e atalho do ativo ja vinculado ao inventario. */
export function InventoryLinkedFields({ entity, linkedDevice, editor, onChangeSelected }) {
  const floorPoints = (editor.connectionPoints || []).filter((point) => point.floorId === entity.floorId);
  const tags = getDeviceTags(linkedDevice);
  return (
    <>
      <label>
        Tomada de energia
        <select
          value={entity.metadata?.powerPointId || ""}
          onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { powerPointId: event.target.value || null }))}
        >
          <option value="">Sem tomada associada</option>
          {floorPoints
            .filter((point) => point.pointType === "power")
            .map((point) => (
              <option key={point.id} value={point.id}>
                {point.label || "Tomada"}
              </option>
            ))}
        </select>
      </label>
      <label>
        Ponto de rede
        <select
          value={entity.metadata?.networkPointId || ""}
          onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { networkPointId: event.target.value || null }))}
        >
          <option value="">Sem ponto associado</option>
          {floorPoints
            .filter((point) => point.pointType === "network")
            .map((point) => (
              <option key={point.id} value={point.id}>
                {point.label || "Ponto RJ45"}
              </option>
            ))}
        </select>
      </label>
      <div className="floor-plan-inspector-tags">
        <span>Tags</span>
        <div>{tags.length > 0 ? tags.map((tag) => <em key={tag}>{tag}</em>) : <small>Nenhuma tag cadastrada</small>}</div>
      </div>
      <button
        className="secondary-action compact-action floor-plan-open-inventory"
        type="button"
        disabled
        title="Navegação direta pelo editor em desenvolvimento"
      >
        Ver no inventário
      </button>
    </>
  );
}
