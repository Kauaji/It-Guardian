import AttendanceFields from "./AttendanceFields.jsx";
import FinancialPanel from "./FinancialPanel.jsx";
import PartsEditor from "./PartsEditor.jsx";
import ServicesEditor from "./ServicesEditor.jsx";

// Aba Atendimento: formulario do tecnico com servicos, pecas e valores.
export default function AttendanceTab({
  draft,
  updateDraft,
  technicians,
  services,
  products,
  serviceSelector,
  partsEditor,
  finance,
  businessMode,
  saving,
  canRegisterAttendance,
  onSubmit
}) {
  const { serviceItems, serviceValueNumber, partsTotal } = finance;
  return (
    <form className="service-order-attendance-form" onSubmit={onSubmit}>
      <AttendanceFields draft={draft} technicians={technicians} updateDraft={updateDraft} />
      <ServicesEditor
        selector={serviceSelector}
        services={services}
        businessMode={businessMode}
        draft={draft}
        serviceValueNumber={serviceValueNumber}
        updateDraft={updateDraft}
      />
      <PartsEditor parts={partsEditor} products={products} businessMode={businessMode} />
      {businessMode && Boolean(serviceItems.length || serviceValueNumber || partsTotal) && (
        <FinancialPanel finance={finance} onRemovePart={partsEditor.removePart} />
      )}
      <div className="modal-actions">
        <button className="primary-action compact-action" disabled={saving || !canRegisterAttendance}>
          {saving ? "Salvando..." : "Salvar atendimento"}
        </button>
      </div>
    </form>
  );
}
