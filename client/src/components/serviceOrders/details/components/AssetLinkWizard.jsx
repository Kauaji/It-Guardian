import { Search } from "lucide-react";

// Assistente de 3 passos (aba, grupo, segmento) mais busca para vincular uma maquina a OS.
export default function AssetLinkWizard({ wizard, inventoryTabs }) {
  const { linkDraft } = wizard;
  return (
    <section className="service-order-link-wizard">
      <label>
        1. Aba/Ambiente
        <select value={linkDraft.tabId} onChange={(event) => wizard.selectTab(event.target.value)}>
          <option value="">Selecione</option>
          {inventoryTabs.map((tab) => (
            <option key={tab.id} value={tab.id}>{tab.name || "Novo ambiente"}</option>
          ))}
        </select>
      </label>
      <label>
        2. Grupo
        <select
          value={linkDraft.groupId}
          disabled={!linkDraft.tabId}
          onChange={(event) => wizard.selectGroup(event.target.value)}
        >
          <option value="">Todos os grupos</option>
          {wizard.visibleGroups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      </label>
      <label>
        3. Segmento
        <select
          value={linkDraft.segmentId}
          disabled={!linkDraft.tabId}
          onChange={(event) => wizard.selectSegment(event.target.value)}
        >
          <option value="">Selecione</option>
          {wizard.visibleSegments.map((segment) => (
            <option key={segment.id} value={segment.id}>{segment.name}</option>
          ))}
        </select>
      </label>
      <label className="service-order-link-search">
        <Search size={16} />
        <input
          value={linkDraft.search}
          disabled={!linkDraft.segmentId}
          onChange={(event) => wizard.changeSearch(event.target.value)}
          placeholder="Buscar máquina no segmento"
        />
      </label>
      <div className="service-order-link-cards">
        {linkDraft.segmentId && wizard.visibleDevices.length ? wizard.visibleDevices.map((device) => (
          <button key={device.id} type="button" onClick={() => wizard.linkAsset(device)}>
            <strong>{device.name}</strong>
            <span>{device.ip || "Sem IP"} - {device.statusLabel || "Sem status"}</span>
          </button>
        )) : (
          <p className="empty">Escolha uma aba, grupo e segmento para listar máquinas.</p>
        )}
      </div>
    </section>
  );
}
