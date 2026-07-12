import { Cable, PlugZap } from "lucide-react";
import {
  VISUAL_MAP_LAYER_OPTIONS,
  getConnectionTypeLabel
} from "./inventoryVisualMapConnectionUtils.js";

function getLayerLabel(layer) {
  return VISUAL_MAP_LAYER_OPTIONS.find((option) => option.key === layer)?.label || "Conexao";
}

function metadataEntries(metadata) {
  return Object.entries(metadata || {}).filter(([, value]) => value !== null && value !== undefined && value !== "");
}

export default function InventoryVisualMapConnectionPanel({ connection }) {
  if (!connection) return null;

  const icon = connection.layer === "electrical" ? <PlugZap size={17} /> : <Cable size={17} />;
  const entries = metadataEntries(connection.metadata);

  return (
    <section className="inventory-visual-connection-summary">
      <div className="inventory-visual-section-title">
        {icon}
        Detalhes da conexao
      </div>
      <dl>
        <div>
          <dt>Camada</dt>
          <dd>{getLayerLabel(connection.layer)}</dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>{getConnectionTypeLabel(connection.connectionType)}</dd>
        </div>
        <div>
          <dt>Identificacao</dt>
          <dd>{connection.label || "Sem identificacao"}</dd>
        </div>
        <div>
          <dt>Pontos</dt>
          <dd>{connection.points?.length || 0}</dd>
        </div>
        <div>
          <dt>Estilo</dt>
          <dd>
            <span className="inventory-visual-color-chip" style={{ backgroundColor: connection.color || "#0ea5e9" }} />
            {connection.dashed ? "Tracejada" : "Continua"} - {connection.thickness || 2}px
          </dd>
        </div>
        {connection.notes && (
          <div>
            <dt>Notas</dt>
            <dd>{connection.notes}</dd>
          </div>
        )}
      </dl>

      {!!entries.length && (
        <div className="inventory-visual-metadata-readonly">
          <strong>Metadados</strong>
          {entries.map(([key, value]) => (
            <span key={key}>
              {key}: {String(value)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
