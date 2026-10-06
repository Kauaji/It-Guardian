import ServiceOrderAgendaTab from "../../tabs/ServiceOrderAgendaTab.jsx";
import ServiceOrderAttachmentsTab from "../../tabs/ServiceOrderAttachmentsTab.jsx";
import ServiceOrderChecklistTab from "../../tabs/ServiceOrderChecklistTab.jsx";
import ServiceOrderFeedbackTab from "../../tabs/ServiceOrderFeedbackTab.jsx";
import ServiceOrderScriptsTab from "../../tabs/ServiceOrderScriptsTab.jsx";
import ServiceOrderSlaTab from "../../tabs/ServiceOrderSlaTab.jsx";

// Abas que apenas delegam a componentes proprios, com as permissoes ja resolvidas.
export default function DetailsTabContent({
  activeTab,
  serviceOrder,
  asset,
  token,
  notify,
  can,
  onOpenCalendar,
  remoteScriptExecutionEnabled
}) {
  switch (activeTab) {
    case "sla":
      return <ServiceOrderSlaTab serviceOrder={serviceOrder} />;
    case "agenda":
      return <ServiceOrderAgendaTab token={token} serviceOrder={serviceOrder} canCreate={can.schedule} onOpenCalendar={onOpenCalendar} />;
    case "checklist":
      return <ServiceOrderChecklistTab serviceOrderId={serviceOrder.id} token={token} notify={notify} canManage={can.attendance} />;
    case "scripts":
      return (
        <ServiceOrderScriptsTab
          serviceOrder={serviceOrder}
          asset={asset}
          token={token}
          notify={notify}
          canManage={can.runScripts}
          canRegisterSimulation={can.registerSimulation}
          remoteScriptExecutionEnabled={remoteScriptExecutionEnabled}
        />
      );
    case "attachments":
      return (
        <ServiceOrderAttachmentsTab
          serviceOrderId={serviceOrder.id}
          token={token}
          notify={notify}
          canAdd={can.attendance}
          canRemove={can.edit}
        />
      );
    case "feedback":
      return <ServiceOrderFeedbackTab serviceOrderId={serviceOrder.id} token={token} notify={notify} canManage={can.attendance} />;
    default:
      return null;
  }
}
