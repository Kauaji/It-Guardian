import { useEffect, useState } from "react";
import { Link2, Trash2, X } from "lucide-react";
import { getEntityKindLabel } from "../utils/planPresentation.js";
import { findSelectedEntity } from "../utils/inspectorPatches.js";
import { isMeasurementObject } from "../utils/measurementGeometry.js";
import { isRoomZone } from "../utils/roomGeometry.js";
import { isOpeningObject, isWallObject } from "../utils/wallGeometry.js";
import { InventoryAssetFields, InventoryLinkPicker, InventoryLinkedFields } from "./InventoryFields.jsx";
import OpeningFields from "./OpeningFields.jsx";
import RackFields from "./RackFields.jsx";
import { MeasurementFields, RoomFloorTextureField, RouteStyleField, WallFields } from "./StructureFields.jsx";

function supportsInventoryLink(selected, entity) {
  return selected.type === "object" && entity.category === "asset" && !isWallObject(entity) && !isOpeningObject(entity);
}

/** Campos especificos do tipo de objeto/zona/rota selecionado (parede, medida, rack, abertura...). */
function TypeSpecificFields({ editor, selected, entity, onChangeSelected }) {
  const isObject = selected.type === "object";
  const availableWalls = isObject
    ? (editor.objects || []).filter((object) => object.floorId === entity.floorId && isWallObject(object))
    : [];
  return (
    <>
      {isObject && isWallObject(entity) && <WallFields entity={entity} onChangeSelected={onChangeSelected} />}
      {isObject && isMeasurementObject(entity) && (
        <MeasurementFields entity={entity} plan={editor?.plan} onChangeSelected={onChangeSelected} />
      )}
      {selected.type === "zone" && isRoomZone(entity) && <RoomFloorTextureField entity={entity} onChangeSelected={onChangeSelected} />}
      {selected.type === "route" && <RouteStyleField entity={entity} onChangeSelected={onChangeSelected} />}
      {isObject && entity.objectType === "rack" && <RackFields entity={entity} onChangeSelected={onChangeSelected} />}
      {isObject && isOpeningObject(entity) && (
        <OpeningFields entity={entity} availableWalls={availableWalls} onChangeSelected={onChangeSelected} />
      )}
    </>
  );
}

/** Campos comuns: ativos de inventario ou nome/cor das demais entidades. */
function CommonFields({ editor, selected, entity, linkedDevice, inventory, picker, onChangeSelected }) {
  const asAsset = supportsInventoryLink(selected, entity);
  return (
    <>
      {asAsset && (
        <InventoryAssetFields
          entity={entity}
          linkedDevice={linkedDevice}
          inventory={inventory}
          showLinkPicker={picker.show}
          onTogglePicker={picker.toggle}
          onChangeSelected={onChangeSelected}
        />
      )}
      {!asAsset ? (
        <label>
          Nome do ativo
          <input
            value={entity.label || entity.name || ""}
            onChange={(event) => onChangeSelected({ label: event.target.value, name: event.target.value })}
          />
        </label>
      ) : null}
      {asAsset && !linkedDevice && picker.show ? (
        <InventoryLinkPicker entity={entity} devices={inventory.devices} onLinkObject={inventory.onLinkObject} onDone={picker.hide} />
      ) : null}
      {asAsset && linkedDevice ? (
        <InventoryLinkedFields entity={entity} linkedDevice={linkedDevice} editor={editor} onChangeSelected={onChangeSelected} />
      ) : null}
      {!asAsset ? (
        <label>
          Cor
          <input type="color" value={entity.color || "#1f7a61"} onChange={(event) => onChangeSelected({ color: event.target.value })} />
        </label>
      ) : null}
    </>
  );
}

export default function FloorPlanInspector({
  editor,
  selected,
  onChangeSelected,
  onClearSelected,
  devices,
  groups,
  segments,
  permissions,
  onLinkObject
}) {
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const selectedEntity = findSelectedEntity(editor, selected);

  useEffect(() => {
    setShowLinkPicker(false);
  }, [selected?.id, selected?.type]);

  if (!selectedEntity) return null;

  const asAsset = supportsInventoryLink(selected, selectedEntity);
  const linkedDevice = asAsset ? devices.find((device) => device.id === selectedEntity.linkedAssetId) : null;
  const inventory = { devices, groups, segments, permissions, onLinkObject };
  const picker = { show: showLinkPicker, toggle: () => setShowLinkPicker((current) => !current), hide: () => setShowLinkPicker(false) };

  return (
    <aside className="floor-plan-inspector">
      <header>
        <span>{getEntityKindLabel(selected.type)}</span>
        <button className="icon-button" type="button" onClick={onClearSelected} title="Fechar propriedades">
          <X size={17} />
        </button>
      </header>
      <CommonFields
        editor={editor}
        selected={selected}
        entity={selectedEntity}
        linkedDevice={linkedDevice}
        inventory={inventory}
        picker={picker}
        onChangeSelected={onChangeSelected}
      />
      <TypeSpecificFields editor={editor} selected={selected} entity={selectedEntity} onChangeSelected={onChangeSelected} />
      {!permissions.linkInventory && asAsset && (
        <div className="floor-plan-inspector-note">
          <Link2 size={16} />
          Seu usuário não pode alterar vínculos com inventário.
        </div>
      )}
      <button
        className="danger-action compact-action floor-plan-remove-selection"
        type="button"
        onClick={() => onChangeSelected({ remove: true })}
      >
        <Trash2 size={16} />
        Remover do mapa
      </button>
    </aside>
  );
}
