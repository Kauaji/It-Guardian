import {
  Crosshair,
  Link2,
  Maximize2,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
  Eye
} from "lucide-react";
import NetworkTopologyAddAssetPicker from "./NetworkTopologyAddAssetPicker.jsx";
import { getStatusColorToken, getStatusLabel } from "./networkTopologyModel.js";

const LEGEND_STATUSES = ["online", "warning", "critical", "unknown", "manual"];
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "problem", label: "Erro" },
  { value: "unknown", label: "Sem dados" }
];

export default function NetworkTopologyToolbar({
  editMode,
  onToggleEditMode,
  onCenterView,
  onFitView,
  onSaveLayout,
  hasDirtyPositions,
  saving,
  onResetLayout,
  onGenerateAutoLayout,
  generatingLayout,
  linkDraftActive,
  onToggleLinkDraft,
  availableDevicesToAdd,
  onAddAsset,
  addingAsset,
  nodeCount,
  linkCount,
  filters,
  onFiltersChange,
  segments,
  assetTypeOptions,
  canManage
}) {
  return (
    <div className="network-topology-toolbar">
      <div className="network-topology-toolbar-row">
        <div className="network-topology-toolbar-group">
          <button
            type="button"
            className={`network-topology-toolbar-button ${editMode ? "is-active" : ""}`}
            onClick={onToggleEditMode}
            disabled={!canManage}
            title={editMode ? "Voltar para modo visualização" : "Entrar em modo edição"}
          >
            {editMode ? <Pencil size={15} /> : <Eye size={15} />}
            {editMode ? "Editando" : "Visualizando"}
          </button>
          <button type="button" className="network-topology-toolbar-button" onClick={onCenterView} title="Centralizar">
            <Crosshair size={15} />
          </button>
          <button type="button" className="network-topology-toolbar-button" onClick={onFitView} title="Ajustar à tela">
            <Maximize2 size={15} />
          </button>
        </div>

        {editMode ? (
          <div className="network-topology-toolbar-group">
            <button
              type="button"
              className="network-topology-toolbar-button"
              onClick={onSaveLayout}
              disabled={!hasDirtyPositions || saving}
            >
              <Save size={15} />
              {saving ? "Salvando..." : "Salvar layout"}
            </button>
            <button
              type="button"
              className="network-topology-toolbar-button"
              onClick={onResetLayout}
              disabled={!hasDirtyPositions}
            >
              <RotateCcw size={15} />
              Resetar
            </button>
            <button
              type="button"
              className="network-topology-toolbar-button"
              onClick={onGenerateAutoLayout}
              disabled={generatingLayout || nodeCount === 0}
            >
              <Sparkles size={15} />
              {generatingLayout ? "Gerando..." : "Gerar automático"}
            </button>
            <button
              type="button"
              className={`network-topology-toolbar-button ${linkDraftActive ? "is-active" : ""}`}
              onClick={onToggleLinkDraft}
              disabled={nodeCount < 2}
              title="Criar conexão entre dois ativos"
            >
              <Link2 size={15} />
              {linkDraftActive ? "Selecione o destino" : "Criar conexão"}
            </button>
          </div>
        ) : null}

        <div className="network-topology-toolbar-counters">
          <span key={nodeCount} className="network-topology-toolbar-counter-pop">{nodeCount} ativo(s)</span>
          <span key={`links-${linkCount}`} className="network-topology-toolbar-counter-pop">{linkCount} conexão(ões)</span>
        </div>
      </div>

      {editMode ? (
        <div className="network-topology-toolbar-row">
          <NetworkTopologyAddAssetPicker devices={availableDevicesToAdd} onPick={onAddAsset} disabled={addingAsset} />
        </div>
      ) : null}

      <div className="network-topology-toolbar-row">
        <input
          type="search"
          className="network-topology-toolbar-input"
          placeholder="Buscar por nome ou IP"
          value={filters.search}
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
        />
        <select
          className="network-topology-toolbar-select"
          value={filters.status}
          onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
        >
          {STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="network-topology-toolbar-select"
          value={filters.segmentId}
          onChange={(event) => onFiltersChange({ ...filters, segmentId: event.target.value })}
        >
          <option value="">Todos os segmentos</option>
          {segments.map((segment) => (
            <option key={segment.id} value={segment.id}>
              {segment.name}
            </option>
          ))}
        </select>
        <select
          className="network-topology-toolbar-select"
          value={filters.assetType}
          onChange={(event) => onFiltersChange({ ...filters, assetType: event.target.value })}
        >
          <option value="">Todos os tipos</option>
          {assetTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="network-topology-legend">
        {LEGEND_STATUSES.map((status) => (
          <span key={status} className="network-topology-legend-item">
            <span
              className="network-topology-legend-dot"
              style={{ background: getStatusColorToken(status) }}
            />
            {getStatusLabel(status)}
          </span>
        ))}
      </div>
    </div>
  );
}
