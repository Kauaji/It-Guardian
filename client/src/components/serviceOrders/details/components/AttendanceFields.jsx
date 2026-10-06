import { priorityLabels } from "../../serviceOrderBoardUtils.js";

// Campos principais do atendimento: titulo, prioridade, tecnico, prioridade automatica e textos.
export default function AttendanceFields({ draft, technicians, updateDraft }) {
  return (
    <>
      <label className="service-order-title-field">
        Título
        <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
      </label>
      <label className="service-order-priority-field">
        Prioridade
        <select value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value)}>
          {Object.entries(priorityLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="service-order-technician-field">
        Técnico responsável
        {technicians.length ? (
          <select
            value={draft.assignedTechnicianName}
            onChange={(event) => updateDraft("assignedTechnicianName", event.target.value)}
          >
            <option value="">Selecione um técnico</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.name}>{technician.name}</option>
            ))}
          </select>
        ) : (
          <div className="service-order-inline-empty">Não existem técnicos cadastrados. Cadastre técnicos nas Configurações da OS.</div>
        )}
      </label>
      <label className="service-order-auto-priority">
        <input
          type="checkbox"
          checked={Boolean(draft.autoPriorityEnabled)}
          onChange={(event) => updateDraft("autoPriorityEnabled", event.target.checked)}
        />
        <span>{draft.autoPriorityEnabled ? "Automática" : "Manual"}</span>
      </label>
      <label className="service-order-wide-field">
        Diagnóstico
        <textarea value={draft.diagnosis} onChange={(event) => updateDraft("diagnosis", event.target.value)} />
      </label>
      <label className="service-order-wide-field">
        Observações do atendimento
        <textarea
          value={draft.attendanceNotes}
          onChange={(event) => updateDraft("attendanceNotes", event.target.value)}
          placeholder="Registre detalhes adicionais do atendimento..."
        />
      </label>
    </>
  );
}
