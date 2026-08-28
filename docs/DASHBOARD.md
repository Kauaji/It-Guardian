# Dashboard

## Visão geral

O Dashboard é um painel **configurável por widgets**, inspirado na
arquitetura de dashboards do Zabbix (sem copiar o visual) — não é mais uma
tela fixa. Cada usuário monta seu próprio conjunto de widgets (adicionar,
remover, mover, redimensionar, configurar), com um layout padrão pronto para
quem nunca customizou nada. Nenhum widget inventa dado: sem informação
suficiente, mostra um estado "sem dados"/"indisponível" explícito, nunca um
valor calculado no frontend ou um zero fabricado.

Protegido por duas permissões:

- `dashboard.view` — ver o dashboard e o layout salvo;
- `dashboard.customize` — entrar em modo edição, salvar ou restaurar o
  layout (tanto `admin` quanto `operator` têm as duas por padrão).

## Persistência do layout

Reaproveita a tabela genérica `user_preferences` (já existente para outras
preferências por usuário, ex. `inventory-workspace`) sob a chave
`dashboard-layout` — **nenhuma migration nova** foi criada para este
recurso. O layout nunca é exposto pela rota genérica
`/api/preferences/:key` (que não teria a permissão nem a validação de forma
corretas para isso); só as rotas dedicadas abaixo leem/escrevem essa chave.

| Método | Rota | Permissão |
| --- | --- | --- |
| `GET` | `/api/dashboard/layout` | `dashboard.view` |
| `PUT` | `/api/dashboard/layout` | `dashboard.customize` |
| `POST` | `/api/dashboard/layout/reset` | `dashboard.customize` |
| `GET` | `/api/dashboard/widgets/catalog` | `dashboard.view` |
| `POST` | `/api/dashboard/widgets/preview` | `dashboard.view` |

`GET /layout` sem preferência salva devolve o **layout padrão calculado no
servidor** (`server/src/services/dashboardWidgets/defaultLayout.js`), nunca
`null` — o frontend não precisa tratar "sem layout" como caso especial.
`POST /layout/reset` apaga a linha salva (não grava um layout vazio), então
o próximo `GET` volta a cair no padrão automaticamente.

Forma de um widget no layout salvo:

```json
{
  "id": "uuid-gerado-no-cliente",
  "type": "metric_gauge_cpu",
  "x": 0,
  "y": 3,
  "w": "m",
  "h": "s",
  "refreshIntervalSeconds": 60,
  "config": { "assetId": "..." },
  "title": "opcional, ate 60 caracteres"
}
```

`x`/`y` são apenas a **ordem de exibição** (o grid do frontend empacota por
densidade a partir da largura de cada widget — `grid-auto-flow: dense` —
não são coordenadas de pixel livre); `w`/`h` são tiers discretos
(`s`/`m`/`l`/`xl` de largura, `s`/`m`/`l` de altura), não redimensionamento
por arrasto. Validado em `server/src/domain/dashboardLayoutValidation.js`:
tipo precisa estar no catálogo real (whitelist, não uma lista fixa
hardcoded), no máximo 30 widgets, `refreshIntervalSeconds` mínimo de 30s,
ids únicos.

## Catálogo de widgets

`server/src/services/dashboardWidgets/widgetRegistry.js` — registry, não um
switch gigante: cada tipo mapeia para `{ label, category, defaultSize,
fetchData }`. `GET /widgets/catalog` serializa essa mesma lista para o
frontend; `POST /widgets/preview` (`{ type, config, filters? }`) despacha para o
`fetchData` do tipo pedido. Um contexto por requisição
(`dashboardWidgets/widgetContext.js`) memoiza as fontes compartilhadas
(`listDevices`, `listServiceOrders`, alertas) — vários widgets pedem a
mesma lista, mas ela só é buscada uma vez por chamada de preview.

19 tipos implementados com dado real:

| Tipo | Fonte |
| --- | --- |
| `status_overview` | Mesma nota de saúde de `infrastructureHealth.js`, recalculada a partir de dispositivos/alertas/OS reais |
| `asset_availability` | Contagem de dispositivos por status |
| `current_problems` | Alertas ativos |
| `top_assets_cpu`/`ram`/`disk` | Ranking por **valor atual** (não há consulta multi-ativo histórica ainda — ver Limitações) |
| `metric_history_cpu`/`ram`/`disk` | Histórico real (`asset_metric_history`), exige `config.assetId` |
| `metric_gauge_cpu`/`ram`/`disk` | Valor atual do ativo configurado |
| `service_orders_by_status` | OS agrupadas por status |
| `service_orders_sla` | Abertas/vencidas/próximas do prazo + tempo médio de resolução e 1ª resposta |
| `service_orders_overdue` | OS com `sla_due_at` real no passado |
| `alerts_by_severity` | Alertas ativos agrupados por severidade |
| `critical_assets` | Ativos com status `problem` ou métrica crítica |
| `recent_events` | Log de auditoria (`audit_logs`) |
| `script_executions` | Execuções recentes de script (`script_execution_logs`) |

Um widget do pedido original ficou de fora deliberadamente: **Assistência
Remota** — não existe consulta multi-sessão em
`remoteAssistanceRepository.js` hoje, e construir uma tocaria justamente o
módulo que essa rodada foi orientada a não alterar. Fica para uma rodada
futura, com autorização explícita.

## Prévias e formatos de visualização

O catálogo permite buscar por nome, filtrar por categoria e escolher o
formato antes de adicionar. As miniaturas são identificadas como **prévias
ilustrativas**; não representam valores do ambiente. Já a prévia do modal
de configuração usa a mesma API de dados reais do widget.

O formato fica em `config.chartType`, junto do layout do usuário:

- disponibilidade: indicadores, barras, colunas, pizza ou rosca;
- alertas por severidade e OS por status: barras, colunas, pizza ou rosca;
- rankings de ativos: barras, colunas ou lista (percentuais individuais
  de utilização não são fatias de um total);
- histórico de CPU/RAM/disco: linha, área ou colunas.

Layouts anteriores, sem `chartType`, continuam válidos. Um formato não
suportado pelo tipo usa o padrão definido em `widgetVisualizations.js`.
O grid adapta as colunas à largura disponível; títulos, indicadores e
gráficos usam o espaço interno do card, e listas extensas têm rolagem local.

## Filtros interativos entre widgets

Em modo de visualização, clicar em uma categoria, indicador ou ativo
selecionável atualiza os demais widgets. A barra de filtros mostra o
recorte aplicado e permite remover uma seleção ou limpar todas. Clicar
novamente na mesma seleção também a remove. Há uma seleção por dimensão;
dimensões diferentes se combinam por interseção (AND).

As dimensões aceitas por `POST /widgets/preview` são `assetStatus`,
`assetId`, `alertSeverity`, `serviceOrderStatus` e `overdue`. Por exemplo:

```json
{
  "type": "asset_availability",
  "config": { "chartType": "donut" },
  "filters": { "assetStatus": "offline" }
}
```

Os filtros são temporários, não alteram o layout nem os registros de
inventário. No modo edição, os cliques de seleção ficam desabilitados.
Uma seleção global de ativo pode recortar um gráfico de métricas sem
substituir o `assetId` salvo na configuração desse gráfico.

O backend valida os filtros e cruza fontes por IDs reais, mantendo as
permissões de leitura das OS. Registros sem vínculo com um ativo não são
associados por nome. OS sem ativo continuam presentes quando o recorte é
somente de OS. Eventos e scripts usam uma janela dos 500 registros mais
recentes antes do filtro; o widget informa essa limitação explicitamente.
Um ativo excluído pelo recorte não exibe métricas de outro escopo.

As seleções têm debounce de 180 ms, e respostas antigas são abortadas ou
descartadas ao mudar o recorte. O limite da rota de preview é de 240
requisições por minuto; os demais limites não foram alterados.

## Componentização (frontend)

`client/src/components/dashboard/widgets/`:

- `DashboardWorkspace.jsx` — orquestrador (carrega o layout via
  `useDashboardLayout`, modo edição opera sobre um **draft** local, só
  persistido em "Salvar" — "Cancelar" nunca chama a API);
- `WidgetGrid.jsx` — grid + `DndContext`/`SortableContext` do
  `@dnd-kit/sortable` (contexto de arrastar próprio, aninhado dentro do
  `DndContext` do shell do app que já cuida do Inventário — dnd-kit suporta
  contextos aninhados como superfícies de arrastar independentes);
- `WidgetChrome.jsx` — moldura comum (título, alça de arrastar, menu de
  configurar/redimensionar/remover, só visíveis em modo edição);
- `WidgetBody.jsx` — busca os dados do widget (`useWidgetData`) e trata os
  estados genéricos (carregando/erro/tipo desconhecido) uma única vez;
- `DashboardFilterContext.jsx` — seleções temporárias, debounce e barra
  de filtros compartilhada pelos widgets;
- `WidgetCategoryChart.jsx`/`WidgetPreview.jsx` — gráficos categóricos
  interativos com controles acessíveis e miniaturas ilustrativas;
- `widgetRegistry.js` — espelha o registry do servidor pelas mesmas chaves
  de `type`; `widgetRegistry.test.mjs` (lado servidor) confere que os dois
  catálogos batem;
- `types/` — um componente por família de widget (13 componentes reais; os
  3 "top ativos" e os pares gráfico/gauge de métrica reaproveitam o mesmo
  componente parametrizado pelo `metric` que a resposta já traz);
- `catalog/WidgetCatalogPanel.jsx`, `DashboardWidgetConfigModal.jsx` —
  adicionar e configurar widget (título, ativo, período, quantidade de
  itens, intervalo de atualização — os campos mostrados variam por tipo via
  `configFields` no registry do cliente);
- `GaugeSvg.jsx` — generaliza o gauge circular que já existia em
  `DashboardHealthScore.jsx` (mesma paleta/técnica) para qualquer valor
  0–100, não só a nota de saúde;
- `WidgetList.jsx`/`WidgetBarList.jsx`/`WidgetChartFrame.jsx` — variantes
  **sem cabeçalho próprio** de `DashboardRankingList.jsx`/`DashboardChartCard.jsx`
  (que já embutem `<section><div class="panel-heading">`) — dentro de um
  widget o título já vem do `WidgetChrome`, um segundo cabeçalho ficaria
  duplicado;
- `widgetGridMath.js` — funções puras (mapeamento de tier para
  `grid-column`/`grid-row`, ordenação, reindexação após reordenar).

`client/src/hooks/useDashboardLayout.js` (espelha `useDashboardSummary.js`)
e `client/src/hooks/useWidgetData.js` (espelha `useMetricHistory.js`:
cache/abort por widget, refresh mínimo de 30s, aborta a requisição em
andamento ao desmontar ou trocar de configuração).

### Nota de implementação: `ResponsiveContainer` do recharts

Mesma armadilha documentada nesta seção antes da reescrita: se um
componente wrapper dentro de um `<ResponsiveContainer>` não repassar as
props injetadas (`width`, `height`, `style`) para o componente real do
recharts, o gráfico mede um tamanho válido mas nunca renderiza nada. Todo
widget de gráfico passa por `WidgetChartFrame.jsx`, que já cuida disso —
nenhum widget novo deve montar um `ResponsiveContainer` cru.

## O que aconteceu com a tela fixa antiga

`DashboardPage.jsx` (o dashboard fixo anterior) **continua existindo,
intocado** — só deixou de ser importado em `App.jsx`. Não foi apagado de
propósito: se algo grave aparecer no sistema novo, o ponto de troca é uma
linha só (trocar `<DashboardWorkspace />` de volta por `<DashboardPage />`)
para reversão instantânea, sem perda de dado (o layout novo vive numa
chave de preferência aditiva, não toca em nada que `DashboardPage.jsx` lia).
`useDashboardSummary.js` e `GET /api/dashboard/summary` (a seção "Endpoint
legado" abaixo) ficam pelo mesmo motivo — órfãos, mas funcionais. Uma
limpeza removendo os dois definitivamente é trabalho futuro, só depois do
sistema novo validado em produção por um tempo razoável.

O layout padrão mapeia as seções de hoje 1:1 (status geral + saúde ->
`status_overview`, cards de resumo -> `asset_availability`, os 6 gráficos ->
`service_orders_by_status`/`alerts_by_severity`/etc., as 5 listas de
ranking -> `top_assets_*`/`critical_assets`/`recent_events`) — um usuário
sem nada salvo vê o equivalente ao dashboard fixo de antes. A tabela de
dispositivos e a lista de avisos (que eram seções da tela fixa) **não**
viraram widget — são superfícies de navegação/seleção, não cards de resumo;
continuam acessíveis por Inventário/Avisos normalmente.

## Endpoint legado: `GET /api/dashboard/summary`

Ainda existe, ainda testado (`dashboard-summary.test.mjs`), **sem nenhum
consumidor no frontend hoje** (órfão, ver seção acima). Descreve um
relatório único e monolítico (`overview`/`assets`/`serviceOrders`/`business`),
diferente do modelo por widget — não é a base do sistema novo, cada widget
tem seu próprio `fetchData` independente em `dashboardWidgets/`.

## Saúde da infraestrutura

Calculada em `server/src/domain/infrastructureHealth.js`, uma função pura e
testável isoladamente (`infrastructureHealth.test.mjs`) — reaproveitada
tanto pelo endpoint legado quanto pelo widget `status_overview`. A nota
começa em 100 e perde pontos por sinal operacional real — nunca por dado
ausente. Cada fator tem um teto de dedução próprio para que um único
problema não domine a nota:

| Fator | Teto de dedução |
| --- | --- |
| % de ativos offline | 40 pontos |
| Alertas críticos ativos | 20 pontos |
| OS vencidas | 15 pontos (contagem real de SLA) |
| Ativos com disco crítico | 15 pontos |
| Ativos com CPU/memória em alerta | 10 pontos |
| Ativos sem contato recente do agente | 10 pontos |
| Ativos com reincidência de problemas | 10 pontos |

Classificação por faixa: `85–100` Saudável, `70–84` Atenção, `50–69` Crítico,
`<50` Emergencial.

## OS vencidas (SLA)

`service_orders` tem um prazo de SLA persistido (`sla_due_at`, calculado na
criação a partir da prioridade — ver
[SLA-ORDENS-DE-SERVICO.md](SLA-ORDENS-DE-SERVICO.md)). Tanto o widget
`service_orders_overdue`/`service_orders_sla` quanto o endpoint legado usam
`calculateServiceOrderSla`/`splitServiceOrdersBySla`
(`server/src/domain/serviceOrderAggregates.js`, extraído nesta rodada para
ser reaproveitado pelos dois) para calcular, a cada leitura e sem gravar
nada, vencidas/próximas do prazo e os tempos médios (`averageMinutesBetween`,
em `server/src/domain/assetMetricThresholds.js`, junto dos limiares
`isMetricCritical`/`isMetricWarning` também extraídos de
`dashboardService.js` nesta rodada). OS sem prazo calculável (prioridade
sem SLA configurado) não entram nas contagens — não é tratada como vencida
por padrão.

## Performance

- Um contexto por requisição de preview memoiza as fontes compartilhadas
  (`listDevices`/`listServiceOrders`/alertas), inclusive entre o cálculo dos
  filtros e o widget. Requisições de widgets distintos têm contextos
  separados;
- cada widget agenda seu próprio refresh, nunca abaixo de 30s;
- `useWidgetData` aborta a requisição em andamento ao desmontar ou trocar de
  configuração, para uma resposta lenta de uma config antiga não sobrescrever
  a atual.

## Como testar

- Backend: `npm run test --workspace server` (validação de layout, cada
  `fetchData` de widget com caso "com dado" e "sem dado", limiares
  extraídos) e `npm run test:integration --workspace server` (CRUD de
  layout com permissão certa/errada, preview por tipo, tipo desconhecido →
  400, reset volta ao padrão);
- Cliente: `npm run test --workspace client` (registry cliente×servidor
  bate, matemática de grade pura, `DashboardWorkspace` — adicionar/remover/
  redimensionar/salvar/cancelar/restaurar, `useWidgetData` respeita
  intervalo mínimo e aborta ao desmontar);
- Fluxos completos: `npx playwright test tests/e2e/dashboard.spec.js`
  (prévia, formato persistido após recarregar, filtros entre widgets e
  encaixe do resumo em desktop compacto/celular, com API local de teste);
- Visual: `npm run dev:server` + `npm run dev`, logar com
  `admin@itguardian.local` / `123456`, entrar em modo edição, adicionar um
  widget do catálogo, configurar um widget de métrica (exige um ativo real
  cadastrado — não existe no seed de demonstração puro, precisa de um
  agente/heartbeat real), redimensionar, salvar, recarregar a página e
  confirmar que persistiu, "Restaurar padrão" volta ao layout inicial.

## Limitações conhecidas

- **Top Ativos por CPU/RAM/Disco ranqueiam pelo valor atual**, não por uma
  média/tendência histórica — não existe consulta multi-ativo em
  `asset_metric_history` ainda (a tabela só suporta consulta por ativo
  único). Uma consulta agregada (`DISTINCT ON` por ativo, por exemplo)
  ficaria para uma rodada futura se um ranking histórico for necessário;
- widget de **Assistência Remota** não implementado (ver "Catálogo de
  widgets" acima);
- redimensionar é por tier discreto (P/M/G/Largo), não arrasto de pixel
  livre — decisão deliberada para evitar a instabilidade de um motor de
  grid livre;
- reordenar por arrastar (`@dnd-kit/sortable`) é o primeiro uso real dessa
  biblioteca neste projeto (antes só `@dnd-kit/core` para o Inventário) —
  testado ao vivo neste round, mas com menos quilometragem de uso real do
  que o resto do sistema.

## Validação para novos widgets

Todo novo tipo de widget precisa de:

1. entrada no registry do servidor (`fetchData`, com fonte real —
   reaproveitando serviços/repositórios existentes quando possível) **e**
   no registry do cliente (`Component`, `label`, `configFields`) — o teste
   de drift (`widgetRegistry.test.mjs`) falha se um dos dois esquecer;
2. teste com dado e sem dado (nunca inventar zero/linha reta quando não há
   amostra suficiente);
3. verificação de permissão (herda `dashboard.view`/`dashboard.customize`
   das rotas, não precisa de permissão própria por tipo);
4. `configFields` correto no registry do cliente, se o widget precisar de
   `asset`/`period`/`limit` no modal de configuração;
5. entrada no `docs/DASHBOARD.md` (tabela de catálogo acima).
