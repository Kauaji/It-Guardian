import { useEffect, useState } from "react";
import { ExternalLink, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import { assetTypeLabel } from "../assetTypes.js";
import { getMachineSourceLabel } from "../agentPresentation.js";
import { LINK_TYPE_OPTIONS } from "./networkTopologyFormatters.js";
import { getAggregateStatusLabel } from "./networkTopologyHierarchy.js";
import { getStatusLabel, isClusterNode, resolveAssetType, resolveEntityLabel } from "./networkTopologyModel.js";

export function NetworkTopologyNodeInspector({
  node,
  device,
  clusterInfo,
  editMode,
  onOpenDetails,
  onOpenCluster,
  onTogglePinned,
  onRemoveNode,
  onAddToMap,
  addingToMap = false,
  onClose
}) {
  if (isClusterNode(node)) {
    const missing = !clusterInfo;
    const isGroup = node.nodeType === "group";
    return (
      <aside className="network-topology-inspector">
        <div className="network-topology-inspector-header">
          <h3>{isGroup ? "Grupo selecionado" : "Segmento selecionado"}</h3>
          <button type="button" className="network-topology-inspector-close" aria-label="Fechar detalhes do item" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {missing ? (
          <p className="network-topology-inspector-empty">
            Este {isGroup ? "grupo" : "segmento"} não existe mais no inventário. Remova o nó ou mantenha-o como
            registro histórico do mapa.
          </p>
        ) : (
          <dl className="network-topology-inspector-fields">
            <div>
              <dt>Nome</dt>
              <dd>{clusterInfo.name}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{getAggregateStatusLabel(clusterInfo.status)}</dd>
            </div>
            {isGroup ? (
              <div>
                <dt>Segmentos</dt>
                <dd>{clusterInfo.segmentCount}</dd>
              </div>
            ) : null}
            <div>
              <dt>Ativos</dt>
              <dd>{clusterInfo.deviceCount}</dd>
            </div>
          </dl>
        )}
        <div className="network-topology-inspector-actions">
          {onAddToMap ? (
            <button type="button" className="network-topology-toolbar-button" onClick={onAddToMap} disabled={addingToMap}>
              <Plus size={15} />
              {addingToMap ? "Adicionando..." : "Adicionar ao mapa"}
            </button>
          ) : null}
          {!missing ? (
            <button type="button" className="network-topology-toolbar-button" onClick={() => onOpenCluster(node)}>
              <ExternalLink size={15} />
              Abrir mapa
            </button>
          ) : null}
          {editMode ? (
            <>
              <button type="button" className="network-topology-toolbar-button" onClick={onTogglePinned}>
                {node.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                {node.pinned ? "Desafixar" : "Fixar posição"}
              </button>
              <button type="button" className="network-topology-toolbar-button is-danger" onClick={onRemoveNode}>
                <Trash2 size={15} />
                Remover do mapa
              </button>
            </>
          ) : null}
        </div>
      </aside>
    );
  }

  const missing = !device;

  return (
    <aside className="network-topology-inspector">
      <div className="network-topology-inspector-header">
        <h3>Ativo selecionado</h3>
        <button type="button" className="network-topology-inspector-close" aria-label="Fechar detalhes do ativo" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {missing ? (
        <p className="network-topology-inspector-empty">
          Este ativo não existe mais no inventário. Remova o nó ou mantenha-o como registro histórico do mapa.
        </p>
      ) : (
        <dl className="network-topology-inspector-fields">
          <div>
            <dt>Nome</dt>
            <dd>{device.name}</dd>
          </div>
          {device.technicalName && device.technicalName !== device.name ? (
            <div>
              <dt>Nome técnico</dt>
              <dd>{device.technicalName}</dd>
            </div>
          ) : null}
          <div>
            <dt>Tipo</dt>
            <dd>{assetTypeLabel(resolveAssetType(device))}</dd>
          </div>
          <div>
            <dt>IP</dt>
            <dd>{device.ip || "—"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{getStatusLabel(device.status === "problem" ? "critical" : device.status)}</dd>
          </div>
          <div>
            <dt>Origem</dt>
            <dd>{getMachineSourceLabel(device)}</dd>
          </div>
        </dl>
      )}
      <div className="network-topology-inspector-actions">
        {onAddToMap ? (
          <button type="button" className="network-topology-toolbar-button" onClick={onAddToMap} disabled={addingToMap}>
            <Plus size={15} />
            {addingToMap ? "Adicionando..." : "Adicionar ao mapa"}
          </button>
        ) : null}
        {!missing ? (
          <button type="button" className="network-topology-toolbar-button" onClick={() => onOpenDetails(device)}>
            <ExternalLink size={15} />
            Abrir ficha
          </button>
        ) : null}
        {editMode ? (
          <>
            <button type="button" className="network-topology-toolbar-button" onClick={onTogglePinned}>
              {node.pinned ? <PinOff size={15} /> : <Pin size={15} />}
              {node.pinned ? "Desafixar" : "Fixar posição"}
            </button>
            <button type="button" className="network-topology-toolbar-button is-danger" onClick={onRemoveNode}>
              <Trash2 size={15} />
              Remover do mapa
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}

export function NetworkTopologyLinkInspector({ link, sourceEntity, targetEntity, editMode, onSave, onRemove, onClose }) {
  const [draft, setDraft] = useState({
    label: link.label || "",
    type: link.type,
    description: link.description || ""
  });

  useEffect(() => {
    setDraft({ label: link.label || "", type: link.type, description: link.description || "" });
  }, [link.id, link.label, link.type, link.description]);

  return (
    <aside className="network-topology-inspector">
      <div className="network-topology-inspector-header">
        <h3>Conexão selecionada</h3>
        <button type="button" className="network-topology-inspector-close" aria-label="Fechar detalhes da conexão" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <p className="network-topology-inspector-connection-summary">
        {resolveEntityLabel(link.sourceType, sourceEntity)} <span>↔</span> {resolveEntityLabel(link.targetType, targetEntity)}
      </p>
      {editMode ? (
        <form
          className="network-topology-inspector-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draft);
          }}
        >
          <label>
            Rótulo
            <input
              type="text"
              value={draft.label}
              onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
              placeholder="Ex.: Uplink principal"
            />
          </label>
          <label>
            Tipo
            <select
              value={draft.type}
              onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
            >
              {LINK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descrição
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              rows={3}
            />
          </label>
          <div className="network-topology-inspector-actions">
            <button type="submit" className="network-topology-toolbar-button">
              Salvar conexão
            </button>
            <button type="button" className="network-topology-toolbar-button is-danger" onClick={onRemove}>
              <Trash2 size={15} />
              Excluir conexão
            </button>
          </div>
        </form>
      ) : (
        <dl className="network-topology-inspector-fields">
          <div>
            <dt>Rótulo</dt>
            <dd>{link.label || "—"}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{LINK_TYPE_OPTIONS.find((option) => option.value === link.type)?.label}</dd>
          </div>
          <div>
            <dt>Descrição</dt>
            <dd>{link.description || "—"}</dd>
          </div>
        </dl>
      )}
      <p className="network-topology-inspector-disclaimer">
        Esta conexão representa uma relação lógica ou física informada manualmente. Sua existência não significa,
        por si só, monitoramento real do link.
      </p>
    </aside>
  );
}
