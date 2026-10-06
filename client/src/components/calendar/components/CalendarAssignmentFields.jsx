const named = (items) =>
  items.map((item) => (
    <option key={item.id} value={item.id}>
      {item.name}
    </option>
  ));

// Responsavel, OS vinculada, hierarquia (aba > grupo > segmento > ativo) e descricao.
export default function CalendarAssignmentFields({
  form,
  set,
  permissions,
  technicians,
  tabs,
  orders,
  groupsForTab,
  segmentsForGroup,
  devicesForSegment,
  onSelectHierarchy,
  onSelectServiceOrder
}) {
  return (
    <>
      <label>
        Técnico
        <select value={form.technicianId} onChange={set("technicianId")} disabled={!permissions.assignTechnician}>
          <option value="">Não atribuído</option>
          {named(technicians)}
        </select>
      </label>
      <label>
        Ordem de Serviço
        <select value={form.serviceOrderId} onChange={(event) => onSelectServiceOrder(event.target.value)}>
          <option value="">Sem OS vinculada</option>
          {orders.map((item) => (
            <option key={item.id} value={item.id}>
              {item.number} · {item.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Aba
        <select value={form.tabId} onChange={(event) => onSelectHierarchy("tabId", event.target.value)}>
          <option value="">Selecione a aba</option>
          {named(tabs)}
        </select>
      </label>
      <label>
        Grupo
        <select value={form.groupId} onChange={(event) => onSelectHierarchy("groupId", event.target.value)} disabled={!form.tabId}>
          <option value="">Selecione o grupo</option>
          {named(groupsForTab)}
        </select>
      </label>
      <label>
        Segmento
        <select value={form.segmentId} onChange={(event) => onSelectHierarchy("segmentId", event.target.value)} disabled={!form.groupId}>
          <option value="">Selecione o segmento</option>
          {named(segmentsForGroup)}
        </select>
      </label>
      <label>
        Máquina/ativo
        <select value={form.assetId} onChange={set("assetId")} disabled={!form.segmentId}>
          <option value="">Sem ativo vinculado</option>
          {devicesForSegment.map((item) => (
            <option key={item.id} value={item.id}>
              {item.alias || item.hostname || item.name || item.id}
            </option>
          ))}
        </select>
      </label>
      <label className="calendar-field-wide">
        Descrição
        <textarea
          value={form.description}
          onChange={set("description")}
          rows={4}
          placeholder="Contexto, materiais e orientações para o atendimento"
        />
      </label>
    </>
  );
}
