# Mapa de Rede (Topologia) do Inventario

## Objetivo

O Mapa de Rede e uma quarta visualizacao do Inventario, ao lado de Quadro,
Plantas e Mapa 3D: grupos, segmentos e ativos reais aparecem como nos num
canvas SVG em seus respectivos niveis, com conexoes manuais entre itens do
mesmo tipo, cor por status e posicoes livres. E inspirado conceitualmente em
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

## Organização hierárquica (Aba → Grupo → Segmento → Ativo)

A partir desta rodada, o Mapa de Rede deixou de ser um canvas único e
global e passou a navegar pela hierarquia real do Inventário:

- **Aba** (nível inicial ao abrir a tela): mostra os grupos daquela aba
  como nos de canvas, com status e contagem agregados. Neste nível a ação
  **Conectar grupos** cria linhas manuais entre dois grupos co-visíveis.
  Segmentos sem grupo tambem aparecem nesse canvas; quando os dois tipos
  coexistem, a acao passa a se chamar **Conectar itens do mesmo tipo**.
- **Grupo**: mostra os segmentos daquele grupo como nos de canvas. A ação
  **Conectar segmentos** cria linhas manuais entre dois segmentos daquele
  grupo.
- **Segmento**: mostra os ativos do segmento. A ação **Conectar ativos**
  preserva o fluxo original de ligação entre duas máquinas ou equipamentos.

Os itens do Inventário aparecem automaticamente em cada nível; salvar uma
posição materializa apenas o no movido. Assim, uma conexão pode ser criada
sem antes gravar posições artificiais para todos os itens.

Um painel lateral (`NetworkTopologyHierarchySidebar`) mostra a árvore
Grupo → Segmento da aba atual (com busca), e um breadcrumb no topo mostra
a posição atual e permite voltar a qualquer nível. **Aba é um filtro, não
um contêiner persistido** — ver "Por que aba não é uma relação real" logo
abaixo.

### Por que aba não é uma relação real

Investigando o código antes de implementar, ficou confirmado que "aba" no
Inventário **não tem relação nenhuma com o banco de dados** hoje. Segmento
→ Grupo é real (`inventory_segments.group_id`), Ativo → Segmento é real
(`device_segments`), mas o `tabId` de um grupo, de um segmento e de um
dispositivo são três ponteiros **independentes**, guardados só no
`localStorage` do navegador (`inventoryLocalState.js` +
`inventoryTabMeta` em `App.jsx`) — podem discordar entre si, e nada no
backend sabe o que é uma "aba". Existe um esqueleto de backend para abas
(`inventoryTabRepository/Service/Controller/Routes.js`), mas é código
morto: nunca foi montado em `app.js` e referencia uma coluna `tab_id` que
não existe em nenhuma tabela.

Por isso, o Mapa de Rede trata aba como **filtro** (reaproveitando
exatamente o mesmo mecanismo que o resto do Inventário já usa), e não
tenta inventar uma hierarquia de banco que não existe. Grupo → Segmento →
Ativo é a hierarquia real e é o que fica persistido.

### Status agregado

Calculado no cliente (`networkTopologyHierarchy.js`), sempre a partir do
status real dos ativos — nunca inventado:

- **Segmento**: sem ativos → `sem_dados`; algum `problem` → `crítico`;
  algum `offline` (sem `problem`) → `atenção`; todos `online` → `online`;
  qualquer outra combinação → `sem_dados`.
- **Grupo** e **Aba**: sem filhos → `sem_dados`; todos os filhos com o
  mesmo status → herda esse status; algum filho `crítico` → `crítico`;
  filhos discordando sem nenhum crítico → `misto`.

### Mapa por nivel (get-or-create)

A coluna `scope_type` de `network_topology_maps` já aceitava
`segment`/`group`/`inventory_tab` desde a v1, mas nenhum código usava isso
— ver "Limitações conhecidas" da versão anterior deste documento. Agora,
`GET /api/topology-maps/by-scope` cria ou reaproveita um mapa para o escopo
`inventory_tab`, `group` ou `segment`. A migration
`026-network-topology-cluster-nodes` estendeu nos e links com tipos
`group`/`segment`, mantendo `asset` como padrao para todos os registros
anteriores. O fluxo antigo (um único
mapa "global", escolhido por dropdown) continua existindo, intacto, atrás
do link "Visão global (legado)" no topo da tela — nenhum mapa/nó/link
criado antes desta rodada foi apagado ou migrado.

### Compatibilidade dos nos e links tipados

`network_topology_nodes.node_type` distingue `asset`, `segment` e `group`;
ativos continuam usando `asset_id`, enquanto clusters usam `ref_id`.
Links usam `source_type`/`target_type` e exigem os dois lados do mesmo tipo.
Os nomes históricos `source_asset_id`/`target_asset_id` foram preservados
como campos genéricos de referência para evitar uma migração destrutiva.

## Onde fica

No modulo Inventario, quarta aba do seletor de visualizacao:
Quadro → Plantas → Mapa 3D → **Mapa de Rede**. Carregada sob demanda
(`lazy()` + `Suspense`, mesmo padrao do Mapa 3D) — abrir Quadro/Plantas/
Mapa 3D nao baixa o codigo do Mapa de Rede.

## Persistencia

- `network_topology_maps`: nome, escopo (`global`, `inventory_tab`, `group`
  ou `segment` em `scope_type`/`scope_id`), autor e auditoria.
- `network_topology_nodes`: `map_id`, `node_type`, `asset_id` para ativos ou
  `ref_id` para grupo/segmento, `x`/`y`, `pinned`, rotulo opcional.
- `network_topology_links`: `map_id`, `source_type`/`target_type`,
  `source_asset_id`/`target_asset_id` como referencias genericas, rotulo,
  tipo (`ethernet`/`wifi`/`fiber`/`logical`/`unknown`), status manual
  opcional e descricao.

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

Duplicidade e bloqueada em duas camadas: restricoes por mapa/tipo/referencia
para nos e uma checagem na camada de servico (`ensureLinkNotDuplicate`) que
considera tambem o tipo de cada ponta e recusa a mesma conexao na ordem
invertida (A→B e B→A contam como a mesma conexao).

## Endpoints

- `GET/POST /api/topology-maps`
- `GET /api/topology-maps/by-scope?scopeType=inventory_tab|group|segment&scopeId=...`
  — get-or-create por nivel. Grupo e segmento sao validados no banco; aba
  usa o id/nome do filtro local do Inventario, que nao possui tabela propria.
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
barra de ferramentas), use a lista buscavel "Adicionar ativo ao mapa..."
— lista so ativos que ainda nao estao no mapa — e clique num resultado. A
posicao inicial e proxima ao centro do canvas, com uma pequena variacao
aleatoria para nao empilhar varios ativos exatamente no mesmo ponto.
Dentro de um segmento (nivel Segmento da hierarquia), o filtro de
segmento fica travado/oculto na barra (`lockSegmentFilter`) — só ativos
daquele segmento aparecem na lista, sem precisar escolher o segmento toda
vez.

## Como criar uma conexao

A acao fica sempre visivel quando o usuario tem permissao e existem pelo
menos dois itens: **Conectar grupos** na aba, **Conectar segmentos** dentro
do grupo e **Conectar ativos** dentro do segmento. Clicar nela entra em
edicao e pede dois cliques, origem e destino. A barra e o guia contextual
mostram qual ponta falta; `Escape`, o botao "Cancelar conexao" ou um clique
no fundo do canvas cancelam a selecao. Depois de salvar, clicar na linha
abre o inspetor para editar rotulo, tipo, status/descricao ou remover a
conexao. Em uma aba mista (grupos e segmentos avulsos), so pares do mesmo
tipo sao aceitos; a acao fica desabilitada se nenhum tipo tiver ao menos
dois nos visiveis.

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

- Aba continua sendo um filtro local, sem entidade/FK propria no banco;
  `scope_type = "inventory_tab"` persiste o mapa usando esse identificador
  local, com a mesma politica ja adotada por Plantas.
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

- Integracao de status de link com dado real de monitoramento
  (OCS/Zabbix), quando existir uma fonte de dado real para isso.
- Alinhamento/guias de arrastar, marcacao em lote, e um modo de
  pre-visualizacao do layout automatico antes de confirmar.
- Arrastar um ativo/segmento diretamente da arvore lateral para o canvas
  (hoje a arvore so navega entre niveis; adicionar ainda usa a lista
  buscavel da barra de ferramentas).
