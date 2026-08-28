import {
  Crosshair,
  Link2,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
  Eye
} from "lucide-react";
import NetworkTopologyAddAssetPicker from "./NetworkTopologyAddAssetPicker.jsx";
import NetworkTopologyAddClusterPicker from "./NetworkTopologyAddClusterPicker.jsx";
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
  onSaveLayout,
  hasDirtyPositions,
  saving,
  onResetLayout,
  onGenerateAutoLayout,
  generatingLayout,
  linkDraftActive,
  linkDraftSourceNodeId,
  creatingLink = false,
  onToggleLinkDraft,
  availableDevicesToAdd,
  onAddAsset,
  availableClustersToAdd,
  onAddCluster,
  addingAsset,
  nodeCount,
  linkCount,
  filters,
  onFiltersChange,
  segments,
  assetTypeOptions,
  canManage,
  canLink = false,
  lockSegmentFilter = false,
  isClusterLevel = false,
  showManualAdd = false
}) {
  const layoutBusy = Boolean(saving || generatingLayout);
  const manualAddBusy = Boolean(addingAsset || layoutBusy);

  return (
    <div className="network-topology-toolbar">
      <div className="network-topology-toolbar-row">
        <div className="network-topology-toolbar-group">
          <button
            type="button"
            className={`network-topology-toolbar-button ${editMode ? "is-active" : ""}`}
            onClick={onToggleEditMode}
            disabled={(!canManage && !canLink) || creatingLink || layoutBusy}
            title={editMode ? "Voltar para modo visualização" : "Entrar em modo edição"}
          >
            {editMode ? <Pencil size={15} /> : <Eye size={15} />}
            {editMode ? "Editando" : "Visualizando"}
          </button>
          <button type="button" className="network-topology-toolbar-button" onClick={onCenterView} title="Centralizar">
            <Crosshair size={15} />
          </button>
        </div>

        {editMode ? (
          <div className="network-topology-toolbar-group">
            {canManage ? <><button
              type="button"
              className="network-topology-toolbar-button"
              onClick={onSaveLayout}
              disabled={!hasDirtyPositions || layoutBusy}
            >
              <Save size={15} />
              {saving ? "Salvando..." : "Salvar layout"}
            </button>
            <button
              type="button"
              className="network-topology-toolbar-button"
              onClick={onResetLayout}
              disabled={!hasDirtyPositions || layoutBusy}
            >
              <RotateCcw size={15} />
              Resetar
            </button>
            {!isClusterLevel ? (
              <button
                type="button"
                className="network-topology-toolbar-button"
                onClick={onGenerateAutoLayout}
                disabled={layoutBusy || nodeCount === 0}
              >
                <Sparkles size={15} />
                {generatingLayout ? "Gerando..." : "Gerar automático"}
              </button>
            ) : null}</> : null}
            {canLink ? <button
              type="button"
              className={`network-topology-toolbar-button ${linkDraftActive ? "is-active" : ""}`}
              onClick={onToggleLinkDraft}
              disabled={nodeCount < 2 || creatingLink || layoutBusy}
              aria-pressed={linkDraftActive}
              title={linkDraftActive ? "Cancelar conexão" : "Criar conexão manual entre dois itens"}
            >
              <Link2 size={15} />
              {creatingLink ? "Salvando conexão…" : linkDraftActive
                ? (linkDraftSourceNodeId ? "Escolha o destino" : "Escolha a origem") : "Criar conexão"}
            </button> : null}
          </div>
        ) : null}

        <div className="network-topology-toolbar-counters">
          <span key={nodeCount} className="network-topology-toolbar-counter-pop">
            {nodeCount} {isClusterLevel ? "item(ns)" : "ativo(s)"}
          </span>
          <span key={`links-${linkCount}`} className="network-topology-toolbar-counter-pop">{linkCount} conexão(ões)</span>
        </div>
      </div>

      {showManualAdd && editMode && canManage ? (
        <fieldset
          className="network-topology-toolbar-row"
          disabled={manualAddBusy}
          style={{ minWidth: 0, margin: 0, padding: 0, border: 0 }}
        >
          {isClusterLevel ? (
            <NetworkTopologyAddClusterPicker items={availableClustersToAdd} onPick={onAddCluster} disabled={manualAddBusy} />
          ) : (
            <NetworkTopologyAddAssetPicker devices={availableDevicesToAdd} onPick={onAddAsset} disabled={manualAddBusy} />
          )}
        </fieldset>
      ) : null}

      {!isClusterLevel ? (
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
          {!lockSegmentFilter ? (
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
          ) : null}
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
      ) : null}

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
