import { useEffect, useState } from "react";
import { Cable, ExternalLink, Monitor, Pin, PinOff, Trash2, X } from "lucide-react";
import { assetTypeLabel } from "../assetTypes.js";
import { getMachineSourceLabel } from "../agentPresentation.js";
import { LINK_TYPE_OPTIONS, linkTypeLabel } from "./networkTopologyFormatters.js";
import { getAggregateStatusLabel } from "./networkTopologyHierarchy.js";
import { getStatusColorToken, getStatusLabel, isClusterNode, resolveAssetType, resolveEntityLabel } from "./networkTopologyModel.js";
import "./networkTopologyInspector.css";

function InspectorFrame({ kind, title, onClose, children }) {
  return (
    <aside
      className="network-topology-inspector is-node-inspector"
      aria-label={"Detalhes do " + kind}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented ||
            event.target.closest('[role="dialog"], [role="alertdialog"], dialog[open]')) return;
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
      }}
    >
      <div className="network-topology-inspector-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="network-topology-inspector-close"
          aria-label={kind === "ativo" ? "Fechar detalhes do ativo" : "Fechar detalhes do item"}
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="network-topology-inspector-content">{children}</div>
    </aside>
  );
}

function InspectorMachines({ devices, onOpenDetails, isGroup }) {
  return (
    <section className="network-topology-inspector-section" aria-label="Máquinas do item">
      <h4><Monitor size={15} aria-hidden="true" />Máquinas <span>{devices.length}</span></h4>
      {!devices.length ? (
        <p className="network-topology-inspector-empty">
          {isGroup ? "Nenhuma máquina nos segmentos deste grupo." : "Nenhuma máquina neste segmento."}
        </p>
      ) : (
        <ul className="network-topology-inspector-machine-list">
          {devices.map((item) => {
            const status = item.status === "problem" ? "critical" : item.status;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="network-topology-inspector-machine"
                  aria-label={"Abrir ficha de " + item.name}
                  onClick={() => onOpenDetails?.(item)}
                  disabled={!onOpenDetails}
                >
                  <span
                    className="network-topology-inspector-status-dot"
                    style={{ backgroundColor: getStatusColorToken(status) }}
                    aria-hidden="true"
                  />
                  <span className="network-topology-inspector-machine-copy">
                    <strong>{item.name}</strong>
                    <span className="network-topology-inspector-machine-meta">
                      <code>{item.ip || "IP não informado"}</code>
                      <span>{getStatusLabel(status)}</span>
                    </span>
                  </span>
                  <ExternalLink size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function InspectorConnections({ connections, loading, error }) {
  return (
    <section className="network-topology-inspector-section" aria-label="Conexões do item" aria-busy={loading}>
      <h4><Cable size={15} aria-hidden="true" />Conexões <span>{connections.length}</span></h4>
      {loading ? <p role="status" className="network-topology-inspector-empty">Carregando conexões...</p> : null}
      {error ? <p role="alert" className="network-topology-inspector-error">{error}</p> : null}
      {connections.length ? (
        <ul className="network-topology-inspector-connection-list">
          {connections.map((connection) => (
            <li key={connection.id}>
              {connection.label ? <strong className="network-topology-inspector-connection-label">{connection.label}</strong> : null}
              <p className="network-topology-inspector-endpoints">
                <span>{connection.sourceName}</span><span aria-hidden="true">↔</span><span>{connection.targetName}</span>
              </p>
              <p className="network-topology-inspector-connection-meta">
                <span>{linkTypeLabel(connection.type)}</span>
                {connection.scopeLabel ? <span>{connection.scopeLabel}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      ) : !loading && !error ? (
        <p className="network-topology-inspector-empty">Nenhuma conexão cadastrada para este item.</p>
      ) : null}
    </section>
  );
}

function InspectorActions({
  node, device, missing, editMode, canEditCluster, onOpenDetails, onOpenCluster, onTogglePinned,
  onRemoveNode, onConnectNode, connecting, preservesConnectionsOnRemove
}) {
  return (
    <div className="network-topology-inspector-actions">
      {!missing && isClusterNode(node) && onOpenCluster ? (
        <button type="button" className="network-topology-toolbar-button is-inspector-primary" onClick={() => onOpenCluster(node)}>
          <ExternalLink size={15} aria-hidden="true" />
          {canEditCluster ? "Editar mapa" : "Abrir mapa"}
        </button>
      ) : !missing && !isClusterNode(node) && onOpenDetails ? (
        <button type="button" className="network-topology-toolbar-button" onClick={() => onOpenDetails(device)}>
          <ExternalLink size={15} aria-hidden="true" />
          Abrir ficha
        </button>
      ) : null}
      {!missing && onConnectNode ? (
        <button type="button" className="network-topology-toolbar-button" onClick={() => onConnectNode(node)} disabled={connecting}>
          <Cable size={15} aria-hidden="true" />
          {connecting ? "Selecione o destino no mapa" : "Conectar a outro item"}
        </button>
      ) : null}
      {editMode && onTogglePinned ? (
        <button type="button" className="network-topology-toolbar-button" onClick={onTogglePinned}>
          {node.pinned ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
          {node.pinned ? "Desafixar" : "Fixar posição"}
        </button>
      ) : null}
      {editMode && onRemoveNode ? (
        <button
          type="button"
          className="network-topology-toolbar-button is-danger"
          onClick={onRemoveNode}
          title={preservesConnectionsOnRemove ? "Remove a posição salva. O item e suas conexões continuam visíveis na prévia." : undefined}
        >
          <Trash2 size={15} aria-hidden="true" />
          {preservesConnectionsOnRemove ? "Remover posição salva" : "Remover do mapa"}
        </button>
      ) : null}
    </div>
  );
}

export function NetworkTopologyNodeInspector({
  node, device, clusterInfo, clusterDevices = [], connections = [], connectionsLoading = false,
  connectionsError = "", canEditCluster = false, editMode, onOpenDetails, onOpenCluster,
  onTogglePinned, onRemoveNode, onConnectNode, connecting = false,
  preservesConnectionsOnRemove = false, onClose
}) {
  const cluster = isClusterNode(node);
  const isGroup = node.nodeType === "group";
  const missing = cluster ? !clusterInfo : !device;
  const kind = cluster ? (isGroup ? "grupo" : "segmento") : "ativo";

  return (
    <InspectorFrame
      kind={kind}
      title={cluster ? (isGroup ? "Grupo selecionado" : "Segmento selecionado") : "Ativo selecionado"}
      onClose={onClose}
    >
      {missing ? (
        <p className="network-topology-inspector-empty">
          Este {kind} não existe mais no inventário. Remova o nó ou mantenha-o como registro histórico do mapa.
        </p>
      ) : cluster ? (
        <dl className="network-topology-inspector-fields">
          <div><dt>Nome</dt><dd>{clusterInfo.name}</dd></div>
          <div><dt>Status</dt><dd>{getAggregateStatusLabel(clusterInfo.status)}</dd></div>
          {isGroup ? <div><dt>Segmentos</dt><dd>{clusterInfo.segmentCount}</dd></div> : null}
          <div><dt>Ativos</dt><dd>{clusterInfo.deviceCount}</dd></div>
        </dl>
      ) : (
        <dl className="network-topology-inspector-fields">
          <div><dt>Nome</dt><dd>{device.name}</dd></div>
          {device.technicalName && device.technicalName !== device.name ? (
            <div><dt>Nome técnico</dt><dd>{device.technicalName}</dd></div>
          ) : null}
          <div><dt>Tipo</dt><dd>{assetTypeLabel(resolveAssetType(device))}</dd></div>
          <div><dt>IP</dt><dd className="network-topology-inspector-ip">{device.ip || "—"}</dd></div>
          <div><dt>Status</dt><dd>{getStatusLabel(device.status === "problem" ? "critical" : device.status)}</dd></div>
          <div><dt>Origem</dt><dd>{getMachineSourceLabel(device)}</dd></div>
        </dl>
      )}
      <InspectorActions
        node={node}
        device={device}
        missing={missing}
        editMode={editMode}
        canEditCluster={canEditCluster}
        onOpenDetails={onOpenDetails}
        onOpenCluster={onOpenCluster}
        onTogglePinned={onTogglePinned}
        onRemoveNode={onRemoveNode}
        onConnectNode={onConnectNode}
        connecting={connecting}
        preservesConnectionsOnRemove={preservesConnectionsOnRemove}
      />
      {cluster && !missing ? <InspectorMachines devices={clusterDevices} onOpenDetails={onOpenDetails} isGroup={isGroup} /> : null}
      <InspectorConnections connections={connections} loading={connectionsLoading} error={connectionsError} />
    </InspectorFrame>
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
    <aside className="network-topology-inspector" aria-label="Detalhes da conexão">
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
    </aside>
  );
}
