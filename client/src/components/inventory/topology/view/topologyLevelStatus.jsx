import ViewLoadingState from "../../../ui/ViewLoadingState.jsx";

// Estados que substituem o canvas: erro, carregamento ou ausencia de mapa legado.
// Devolve null quando o canvas pode ser exibido.
export default function topologyLevelStatus({ error, viewLevel, maps, legacyActiveMapId, loadingBundle, bundle, canManageMap, creatingMap, handleCreateMap }) {
  // A failed first load has no bundle; report it before the loading guard.
  if (error) {
    return (
      <div className="network-topology-empty-state" role="alert">
        <h3>Não foi possível carregar o mapa de rede</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (viewLevel === "global-legado" && maps === null) {
    return <ViewLoadingState />;
  }
  if (viewLevel === "global-legado" && !legacyActiveMapId) {
    return (
      <div className="network-topology-empty-state">
        <h3>Nenhum mapa de rede criado</h3>
        <p>
          Gere uma topologia inicial a partir dos ativos do inventário ou crie um mapa manual para começar a
          desenhar as conexões da sua rede.
        </p>
        {canManageMap ? (
          <button type="button" className="network-topology-toolbar-button" disabled={creatingMap} onClick={handleCreateMap}>
            {creatingMap ? "Criando..." : "Criar mapa"}
          </button>
        ) : null}
      </div>
    );
  }

  if (loadingBundle || !bundle) {
    return <ViewLoadingState />;
  }
  return null;
}
