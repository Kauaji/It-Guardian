import { buildDoorTypePatch, buildMetadataPatch, buildOpeningWallPatch } from "../utils/inspectorPatches.js";
import { isAnchoredOpening } from "../utils/wallGeometry.js";

const DOOR_TYPES = [
  ["single", "Porta simples"],
  ["double", "Porta dupla"],
  ["sliding", "Porta de correr"],
  ["pocket", "Porta embutida"]
];

function DoorFields({ entity, onChangeSelected }) {
  const isSlidingKind = ["sliding", "pocket"].includes(entity.metadata?.doorType);
  return (
    <>
      <label>
        Tipo da porta
        <select value={entity.metadata?.doorType || "single"} onChange={(event) => onChangeSelected(buildDoorTypePatch(entity, event.target.value))}>
          {DOOR_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {isSlidingKind ? (
        <label>
          Direção de correr
          <select
            value={entity.metadata?.slideDirection || "right"}
            onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { slideDirection: event.target.value }))}
          >
            <option value="right">Para a direita</option>
            <option value="left">Para a esquerda</option>
          </select>
        </label>
      ) : (
        <label>
          Abertura da porta
          <select
            value={entity.metadata?.swing || "inward"}
            onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { swing: event.target.value }))}
          >
            <option value="inward">Para dentro</option>
            <option value="outward">Para fora</option>
          </select>
        </label>
      )}
    </>
  );
}

/** Parede vinculada, posicao na parede e, para portas, tipo e sentido de abertura. */
export default function OpeningFields({ entity, availableWalls, onChangeSelected }) {
  return (
    <>
      <label>
        Parede vinculada
        <select value={entity.metadata?.parentObjectId || ""} onChange={(event) => onChangeSelected(buildOpeningWallPatch(entity, event.target.value))}>
          <option value="">Sem parede</option>
          {availableWalls.map((wall) => <option key={wall.id} value={wall.id}>{wall.label || "Parede"}</option>)}
        </select>
      </label>
      {isAnchoredOpening(entity) ? (
        <label>
          Posicao na parede ({Math.round(Number(entity.metadata?.anchorOffset || 0) * 100)}%)
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={Number(entity.metadata?.anchorOffset ?? 0.5)}
            onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { anchorOffset: Number(event.target.value) }))}
          />
        </label>
      ) : null}
      {entity.objectType === "door" ? <DoorFields entity={entity} onChangeSelected={onChangeSelected} /> : null}
    </>
  );
}
