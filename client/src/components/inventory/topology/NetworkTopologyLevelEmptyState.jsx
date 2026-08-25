const VARIANTS = {
  "tab-sem-grupos": {
    title: "Comece organizando sua infraestrutura",
    text: "Organize computadores e dispositivos dentro dos segmentos, depois agrupe os segmentos em grupos - essa aba mostra os grupos assim que existirem."
  },
  "group-sem-segmentos": {
    title: "Este grupo ainda não tem segmentos",
    text: "Segmentos são criados e atribuídos a grupos no Inventário. Mova ou crie um segmento apontando para este grupo para ele aparecer aqui."
  },
  "segment-sem-ativos": {
    title: "Não há ativos neste segmento",
    text: "Cadastre ativos no Inventário ou mova máquinas para este segmento para começar a posicioná-los no mapa."
  }
};

export default function NetworkTopologyLevelEmptyState({ variant, onGoToInventory }) {
  const content = VARIANTS[variant] || VARIANTS["tab-sem-grupos"];

  return (
    <div className="network-topology-empty-state">
      <h3>{content.title}</h3>
      <p>{content.text}</p>
      {onGoToInventory ? (
        <button type="button" className="network-topology-toolbar-button" onClick={onGoToInventory}>
          Ver inventário
        </button>
      ) : null}
    </div>
  );
}
