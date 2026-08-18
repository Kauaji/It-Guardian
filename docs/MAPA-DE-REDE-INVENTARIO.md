# Mapa de Rede (Topologia) do Inventario

## Objetivo

O Mapa de Rede e uma quarta visualizacao do Inventario, ao lado de Quadro,
Plantas e Mapa 3D: ativos reais do inventario aparecem como nos num canvas
SVG, com conexoes manuais entre eles, cor por status, arrastar-para-
posicionar e um layout automatico inicial. E inspirado conceitualmente em
ferramentas de mapa de rede como o Zabbix Maps — nenhum asset, icone,
texto ou layout foi copiado; a interface segue a identidade visual e os
componentes ja existentes do IT Guardian (`AssetTypeIcon`, tokens de cor,
`MachineDetailsModal`).

## Mapa topologico x planta fisica

**Plantas** (`FloorPlansModule`) representa a disposicao fisica real de um
ambiente — salas, moveis, racks, distancias reais numa planta baixa.

**Mapa de Rede** representa relacoes logicas ou fisicas entre ativos, sem
nenhum compromisso com posicionamento fisico real — e um diagrama de
topologia, nao uma planta. As posicoes dos nos so importam para leitura
visual (agrupar, separar, aproximar ativos relacionados), nunca
correspondem a coordenadas reais de um predio.

## Conexao manual x monitoramento real

**Este e o ponto mais importante do recurso**: uma conexao no Mapa de Rede
e informada manualmente pelo tecnico (ou por engenharia de rede) — o
sistema no faz nenhuma descoberta automatica de topologia de rede (sem
SNMP, sem varredura de switches, sem LLDP/CDP). A cor da conexao e uma
leitura indireta do status dos dois ativos que ela liga (`online`,
`offline`, `problem` no cadastro do ativo — nunca uma medicao real do
link):

- verde: os dois ativos estao online.
- vermelho: um dos dois esta offline ou com problema.
- cinza: dado insuficiente (ex.: um dos ativos foi removido do
  inventario).
- azul: o tecnico definiu manualmente um status para a conexao
  (`statusOverride`), sobrepondo a leitura automatica.

**A existencia de uma linha no mapa nao significa, por si so,
monitoramento real do link.** Não ha, hoje, nenhuma integracao com
OCS/Zabbix para status de enlace — isso e um proximo passo possivel, nao
uma capacidade atual.

## Onde fica

No modulo Inventario, quarta aba do seletor de visualizacao:
Quadro → Plantas → Mapa 3D → **Mapa de Rede**. Carregada sob demanda
(`lazy()` + `Suspense`, mesmo padrao do Mapa 3D) — abrir Quadro/Plantas/
Mapa 3D nao baixa o codigo do Mapa de Rede.

## Persistencia

- `network_topology_maps`: nome, escopo (`scope_type`/`scope_id`, hoje só
  `global` é usado pela interface — ver Limitacoes), autor, auditoria.
- `network_topology_nodes`: `map_id`, `asset_id` (sem chave estrangeira —
  ver justificativa abaixo), `x`/`y`, `pinned`, rotulo opcional.
- `network_topology_links`: `map_id`, `source_asset_id`/`target_asset_id`
  (sem chave estrangeira), rotulo, tipo (`ethernet`/`wifi`/`fiber`/
  `logical`/`unknown`), status manual opcional, descricao.

**Por que `asset_id` nao tem `REFERENCES`**: ativos do IT Guardian vem de
fontes diferentes (agente Windows, cadastro manual, OCS, Zabbix) sem uma
tabela unica que os contenha todos. Uma chave estrangeira exigiria decidir
contra qual tabela, e uma politica de `ON DELETE` (cascade quebraria o
mapa ao remover qualquer ativo; `SET NULL` nao faz sentido para um campo
obrigatorio). A escolha foi guardar o id como texto solto e resolver "o
ativo ainda existe?" no frontend, comparando com a lista atual de
devices — exatamente a regra de negocio pedida ("remover um ativo do
inventario nao deve quebrar o mapa"; o no aparece marcado como "Ativo
removido do inventário").

Duplicidade e bloqueada em duas camadas: indice unico `(map_id,
asset_id)` para nos, e `(map_id, source_asset_id, target_asset_id)` mais
uma checagem na camada de servico (`ensureLinkNotDuplicate`) que tambem
recusa a mesma conexao na ordem invertida (A→B e B→A contam como a
mesma conexao).

## Endpoints

- `GET/POST /api/topology-maps`
- `GET/PATCH/DELETE /api/topology-maps/:id` — o `GET` retorna
  `{map, nodes, links}` num payload so.
- `POST /api/topology-maps/:id/nodes`
- `PATCH/DELETE /api/topology-map-nodes/:nodeId`
- `PATCH /api/topology-maps/:id/nodes/positions` — salvamento em lote das
  posicoes arrastadas no canvas (o botao "Salvar layout" dispara um unico
  PATCH, nao um por no movido).
- `POST /api/topology-maps/:id/links`
- `PATCH/DELETE /api/topology-map-links/:linkId`
- `POST /api/topology-maps/:id/auto-layout`

## Permissoes

Grupo dedicado `network_topology` em `shared/permissions.js`:

- `inventory.topology.view` — visualizar o mapa.
- `inventory.topology.manage` — criar/editar/excluir mapas e nos, gerar
  layout automatico, salvar posicoes.
- `inventory.topology.link_assets` — criar/editar/excluir conexoes.

`admin` tem as tres automaticamente; `operator` recebeu as tres por
padrao (mesmo tratamento dado a `floor_plans.*`). O frontend so esconde
controles sem permissao — o backend valida permissao por rota,
independente do que o frontend mostra.

## Como criar um mapa

No Inventario, aba "Mapa de Rede": se nenhum mapa existir, aparece o
estado vazio ("Nenhum mapa de rede criado") com o botao "Criar mapa".

## Como adicionar um ativo ao mapa

Em modo edicao (botao "Editando"/"Visualizando" no canto esquerdo da
barra de ferramentas), use o seletor "Adicionar ativo ao mapa..." — lista
so ativos que ainda nao estao no mapa — e clique "Adicionar". A posicao
inicial e proxima ao centro do canvas, com uma pequena variacao aleatoria
para nao empilhar varios ativos exatamente no mesmo ponto.

## Como criar uma conexao

Em modo edicao, clique "Criar conexao", depois clique no ativo de origem
e no ativo de destino (dois cliques, nessa ordem). O botao mostra
"Selecione o destino" enquanto aguarda o segundo clique. Clicar em
qualquer lugar vazio do canvas cancela o modo de criacao de conexao.

## Como salvar o layout

Arrastar um no so muda a posicao localmente (o botao "Salvar layout" fica
habilitado quando ha alteracoes pendentes). Isso e deliberado: um
salvamento explicito, nao automatico a cada pixel arrastado, para reduzir
a superficie de erro de rede numa primeira versao do recurso (o Mapa 3D e
as Plantas ja tem padroes mais elaborados de autosave/dirty-tracking; o
Mapa de Rede comeca mais simples de proposito). O botao "Resetar" descarta
as alteracoes locais nao salvas.

## Layout automatico

"Gerar automatico" posiciona ativos "centrais" (tipo `server`, `switch`,
`router` ou `nas`) num anel proximo do centro, e os demais tentam ficar
proximos do angulo do central com quem tem conexao (efeito estrela); sem
central ou sem conexao, cai numa grade. Nos marcados como "Fixar posicao"
nunca sao movidos pelo layout automatico — mas continuam podendo ser
arrastados manualmente. O calculo roda no backend
(`networkTopologyAutoLayout.js`, funcao pura testada isoladamente) e
persiste direto, sem etapa de pre-visualizacao client-side — uma
simplificacao deliberada em relacao ao plano original, que cortou uma
segunda implementacao do mesmo algoritmo so para preview.

## Abrir a ficha do ativo

Clicar num no seleciona o ativo no painel lateral; o botao "Abrir ficha"
abre o `MachineDetailsModal` ja existente no Inventario — reaproveitado
diretamente (a mesma instancia usada pelo Quadro), nao um modal novo.

## Filtros

Busca por nome/IP, status, segmento e tipo de ativo. Ocultam nos cujo
ativo nao passa no filtro; uma conexao so aparece quando os dois ativos
que ela liga estao visiveis.

## Limitacoes conhecidas

- A v1 so cria mapas com `scope_type = "global"` — a coluna existe para
  mapas por aba/segmento/grupo no futuro, mas a interface atual nao
  oferece essa escolha.
- Sem integracao real de monitoramento de link (ver secao acima).
- Pan/zoom e drag-and-drop sao implementacao propria (SVG + `viewBox` +
  eventos de ponteiro), inspirados no padrao ja usado em Plantas, mas sem
  os recursos de alinhamento/guia visual que Plantas tem.
- Verificacao end-to-end desta rodada rodou no navegador de automacao
  desta sessao, que nao compoe frames de aba nao exibida (limitacao ja
  documentada nesta sessao para outra mudanca de CSS) — a validacao se
  apoiou em leitura de DOM/`getComputedStyle` e chamadas de API reais
  (todas as acoes de CRUD confirmadas por requisicoes HTTP reais com
  resposta 200/201, nao so inspecao visual).

## Proximos passos

- Mapas por aba/segmento/grupo (usar as colunas `scope_type`/`scope_id`
  ja existentes).
- Integracao de status de link com dado real de monitoramento
  (OCS/Zabbix), quando existir uma fonte de dado real para isso.
- Alinhamento/guias de arrastar, marcacao em lote, e um modo de
  pre-visualizacao do layout automatico antes de confirmar.
