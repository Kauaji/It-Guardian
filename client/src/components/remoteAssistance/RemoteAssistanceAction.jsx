import { createPortal } from "react-dom";
import RemoteAssistanceTrigger from "./components/RemoteAssistanceTrigger.jsx";
import RemoteDialogHeader from "./components/RemoteDialogHeader.jsx";
import RemoteReauthPanel from "./components/RemoteReauthPanel.jsx";
import RemoteViewer from "./components/RemoteViewer.jsx";
import { useRemoteAssistanceDialog } from "./hooks/useRemoteAssistanceDialog.js";
import { useRemoteAvailability } from "./hooks/useRemoteAvailability.js";

// Fluxo de assistencia remota: reautenticacao do tecnico, pedido, consentimento
// do usuário local, visor (snapshots/WebRTC) ou painel RustDesk, chat, controle
// e encerramento. A logica vive em ./hooks, a interface em ./components.
export default function RemoteAssistanceAction({ asset, alias, serviceOrder = null, token, user, notify, compact = false }) {
  const availability = useRemoteAvailability({ asset, user, token, compact });
  const dialogState = useRemoteAssistanceDialog({ asset, alias, serviceOrder, token, notify, availability });
  const { visible, renderCompactSlot, unavailableTitle, config, frontendControlEnabled, canControl, canChat } = availability;
  const { open, view, remote, form } = dialogState;

  if (!visible && !renderCompactSlot) return null;

  const dialog = open ? (
    <div className="modal-backdrop remote-assistance-backdrop" role="presentation">
      <section
        ref={dialogState.dialogRef}
        className={`remote-assistance-modal ${view.maximized ? "remote-assistance-modal--maximized" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Assistência remota"
      >
        <RemoteDialogHeader displayName={view.displayName} asset={asset} onClose={dialogState.closeDialog} />
        {!view.session ? (
          <RemoteReauthPanel
            asset={asset}
            serviceOrder={serviceOrder}
            form={form}
            controlOptionVisible={Boolean(frontendControlEnabled && config?.controlEnabled && canControl)}
            error={remote.error}
            submitting={remote.submitting}
            onSubmit={dialogState.startSession}
          />
        ) : (
          <RemoteViewer
            view={view}
            control={dialogState.control}
            chat={dialogState.chat}
            canChat={canChat}
            screen={{
              frame: dialogState.viewer.frame,
              videoRef: dialogState.webrtc.videoRef,
              trackActive: dialogState.webrtc.trackActive
            }}
            rustdesk={dialogState.rustdesk}
            metrics={remote.metrics}
            latency={dialogState.viewer.latency}
            events={remote.events}
            error={remote.error}
            actions={dialogState.actions}
            screenRef={dialogState.screenRef}
          />
        )}
      </section>
    </div>
  ) : null;

  return (
    <>
      <RemoteAssistanceTrigger
        compact={compact}
        serviceOrder={serviceOrder}
        visible={visible}
        unavailableTitle={unavailableTitle}
        onOpen={dialogState.openDialog}
      />
      {dialog && createPortal(dialog, document.body)}
    </>
  );
}
