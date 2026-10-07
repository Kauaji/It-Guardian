import RemoteChat from "./RemoteChat.jsx";
import RemoteEvents from "./RemoteEvents.jsx";
import RemoteFooterMetrics from "./RemoteFooterMetrics.jsx";
import RemoteRustdeskPanel from "./RemoteRustdeskPanel.jsx";
import RemoteScreen from "./RemoteScreen.jsx";
import RemoteToolbar from "./RemoteToolbar.jsx";

// Corpo do dialogo com a sessao criada: barra de controles, visor (ou painel
// RustDesk), rodape, auditoria recente e chat.
export default function RemoteViewer({
  view,
  control,
  chat,
  canChat,
  screen,
  rustdesk,
  metrics,
  latency,
  events,
  error,
  actions,
  screenRef
}) {
  const { session, isRustdesk } = view;
  return (
    <div className="remote-assistance-viewer">
      <RemoteToolbar view={view} control={control} chatOpen={chat.open} actions={actions} />

      {isRustdesk ? (
        <RemoteRustdeskPanel
          session={session}
          credentials={rustdesk.credentials}
          revealing={rustdesk.revealing}
          error={rustdesk.error}
          onReveal={rustdesk.reveal}
          onCopy={rustdesk.copy}
        />
      ) : (
        <RemoteScreen view={view} screen={screen} control={control} screenRef={screenRef} />
      )}

      <RemoteFooterMetrics
        session={session}
        isRustdesk={isRustdesk}
        metrics={metrics}
        latency={latency}
        controlActive={control.controlActive}
      />

      <RemoteEvents events={events} />

      {chat.open && <RemoteChat chat={chat} canChat={canChat} session={session} />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
