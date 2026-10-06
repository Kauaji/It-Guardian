import { metersToPx, pxToMeters } from "../utils/unitConversion.js";
import { buildMetadataPatch } from "../utils/inspectorPatches.js";

const WALL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const WALL_TEXTURES = [
  ["paint", "Pintura lisa"],
  ["concrete", "Concreto"],
  ["brick", "Tijolo"],
  ["wood", "Madeira"]
];

const FLOOR_TEXTURES = [
  ["ceramic", "Cerâmica"],
  ["wood", "Madeira"],
  ["carpet", "Carpete"],
  ["concrete", "Concreto"]
];

const ROUTE_STYLES = [
  ["free", "Cabo aparente"],
  ["conduit", "Eletroduto"],
  ["channel", "Canaleta"]
];

function MetadataSelect({ label, entity, field, fallback, options, onChangeSelected }) {
  return (
    <label>
      {label}
      <select
        value={entity.metadata?.[field] || fallback}
        onChange={(event) => onChangeSelected(buildMetadataPatch(entity, { [field]: event.target.value }))}
      >
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );
}

export function WallFields({ entity, onChangeSelected }) {
  return (
    <>
      <div className="floor-plan-inspector-grid">
        <label>
          Comprimento
          <input type="number" min="40" step="5" value={Math.round(entity.width || 0)} onChange={(event) => onChangeSelected({ width: Number(event.target.value) })} />
        </label>
        <label>
          Espessura
          <input type="number" min="4" step="1" value={Math.round(entity.height || 0)} onChange={(event) => onChangeSelected({ height: Number(event.target.value) })} />
        </label>
        <label>
          Angulo
          <select value={Number(entity.rotation || 0)} onChange={(event) => onChangeSelected({ rotation: Number(event.target.value) })}>
            {WALL_ANGLES.map((angle) => <option key={angle} value={angle}>{angle} graus</option>)}
          </select>
        </label>
        <label>
          Altura 3D
          <input type="number" min="24" step="2" value={Math.round(entity.height3d || 110)} onChange={(event) => onChangeSelected({ height3d: Number(event.target.value) })} />
        </label>
      </div>
      <MetadataSelect label="Textura da parede" entity={entity} field="texturePreset" fallback="paint" options={WALL_TEXTURES} onChangeSelected={onChangeSelected} />
    </>
  );
}

export function MeasurementFields({ entity, plan, onChangeSelected }) {
  return (
    <div className="floor-plan-inspector-grid">
      <label>
        Comprimento (m)
        <input
          type="number"
          min="0.05"
          step="0.05"
          value={Number(pxToMeters(entity.width || 0, plan).toFixed(2))}
          onChange={(event) => onChangeSelected({ width: metersToPx(Number(event.target.value), plan) })}
        />
      </label>
      <label>
        Angulo
        <input
          type="number"
          step="1"
          value={Math.round(entity.rotation || 0)}
          onChange={(event) => onChangeSelected({ rotation: Number(event.target.value) })}
        />
      </label>
    </div>
  );
}

export function RoomFloorTextureField({ entity, onChangeSelected }) {
  return <MetadataSelect label="Textura do piso" entity={entity} field="floorTexture" fallback="ceramic" options={FLOOR_TEXTURES} onChangeSelected={onChangeSelected} />;
}

export function RouteStyleField({ entity, onChangeSelected }) {
  return <MetadataSelect label="Tipo de passagem" entity={entity} field="routeStyle" fallback="free" options={ROUTE_STYLES} onChangeSelected={onChangeSelected} />;
}
