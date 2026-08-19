# Dashboard

## Fonte dos dados

O dashboard usa dados retornados pelo backend, consolidados em um único
endpoint (`GET /api/dashboard/summary`). Nenhuma métrica é inventada no
frontend. Quando a informação não existe (ou depende de um dado que ainda não
é persistido), a interface mostra um estado "indisponível" explícito em vez de
ocultar o card silenciosamente ou simular um valor.

Protegido por `dashboard.view` (`requirePermission`). Sem a permissão, a API
responde `403` e o frontend não deve tentar renderizar o resumo.

## Endpoint

`GET /api/dashboard/summary?period=<today|7d|15d|30d|90d>`

`period` é validado contra uma allowlist; qualquer valor fora dela cai no
padrão (`30d`) sem quebrar a resposta. O corpo tem quatro seções:

- `overview`: saúde da infraestrutura (nota, classificação, deduções) e
  contadores agregados (ativos, online/offline, críticos, OS abertas/vencidas,
  em manutenção, alertas resolvidos hoje);
- `assets`: distribuição por status, rankings de máquinas problemáticas e sem
  contato recente, série de alertas por dia;
- `serviceOrders`: distribuição por status/prioridade, tendência de OS
  abertas no período, OS abertas mais antigas, técnicos com mais OS
  resolvidas;
- `business`: visão por ambiente/cliente, habilitada apenas quando o sistema
  está em modo Business e existem OS vinculadas a um ambiente.

Todas as agregações reaproveitam os serviços já existentes (`monitoringService`,
`alertService`, `serviceOrderService`) em vez de duplicar consultas.

## Saúde da infraestrutura

Calculada em `server/src/domain/infrastructureHealth.js`, uma função pura e
testável isoladamente (`infrastructureHealth.test.mjs`). A nota começa em 100
e perde pontos por sinal operacional real — nunca por dado ausente. Cada fator
tem um teto de dedução próprio para que um único problema não domine a nota:

| Fator | Teto de dedução |
| --- | --- |
| % de ativos offline | 40 pontos |
| Alertas críticos ativos | 20 pontos |
| OS vencidas | 15 pontos (contagem real de SLA, ver seção abaixo) |
| Ativos com disco crítico | 15 pontos |
| Ativos com CPU/memória em alerta | 10 pontos |
| Ativos sem contato recente do agente | 10 pontos |
| Ativos com reincidência de problemas | 10 pontos |

Classificação por faixa: `85–100` Saudável, `70–84` Atenção, `50–69` Crítico,
`<50` Emergencial.

## OS vencidas (SLA)

Desde a rodada "Evolução Profissional do Módulo de OS", `service_orders` tem
um prazo de SLA persistido (`sla_due_at`, calculado uma vez na criação a
partir da prioridade — ver [SLA-ORDENS-DE-SERVICO.md](SLA-ORDENS-DE-SERVICO.md)).
O dashboard usa isso para calcular, a cada leitura e sem gravar nada:

- `overview.overdueServiceOrders`: contagem real de OS abertas com SLA
  vencido; `overview.overdueServiceOrdersAvailable` agora é sempre `true`;
- `overview.nearDueServiceOrders`: OS abertas próximas do vencimento;
- `overview.averageResolutionMinutes` / `averageFirstResponseMinutes`: médias
  reais (retornam `null`, nunca `0`, quando não há OS com os timestamps
  necessários — sem inventar dado);
- `serviceOrders.overdue`: lista das até 5 OS mais próximas/mais vencidas,
  ordenadas por prazo, com `overdueMinutes`;
- o fator "OS vencidas" da saúde da infraestrutura agora reflete a contagem
  real (antes sempre recebia `0`).

OS sem prazo calculável (prioridade sem SLA configurado) simplesmente não
entram nas contagens de vencida/próxima — não é tratada como vencida por
padrão.

## Visão Local vs. Business

A seção `business` só é habilitada quando o sistema está em modo Business
(`systemMode === "business"`). Mesmo habilitada, se não houver nenhuma OS
vinculada a um ambiente/organização, a API retorna uma mensagem explicando a
situação (`"Dados por cliente serão exibidos quando houver ordens de serviço
vinculadas a um ambiente/organização."`) em vez de inventar clientes. O
frontend nunca simula dados multi-tenant.

## Filtros

O único filtro aplicado hoje é o período (`today`/`7d`/`15d`/`30d`/`90d`), que
recalcula toda a resposta no backend. Filtros adicionais (cliente, segmento,
tipo, severidade, status) só devem ser adicionados quando existir uma consulta
real para sustentá-los — não são simulados na interface.

## Performance

- Um único endpoint consolidado evita N chamadas paralelas no primeiro
  carregamento;
- rankings e séries têm limite fixo (`RANKING_LIMIT`) para não crescer sem
  controle;
- `useDashboardSummary` atualiza automaticamente a cada 60s, mas pausa quando
  a aba fica em segundo plano (`document.visibilityState`).

## Componentização

`client/src/components/dashboard/`:

- `DashboardPage.jsx` — orquestrador, busca o resumo via `useDashboardSummary`;
- `DashboardKpiCard.jsx`, `DashboardHealthScore.jsx` — indicadores;
- `DashboardFilters.jsx` — período + atualizar;
- `DashboardChartCard.jsx` — moldura de gráfico com estados de loading/vazio;
- `DashboardRankingList.jsx` — listas de ranking, opcionalmente clicáveis para
  navegar a outro módulo;
- `dashboardFormatters.js`, `dashboardModel.js` — funções puras de apresentação.

### Nota de implementação: `ResponsiveContainer` do recharts

`DashboardChartCard` mede o tamanho do card e passa a criança (`children`)
para dentro de um `<ResponsiveContainer>`. Se essa criança for um componente
wrapper (como `SimpleBarChart`), ele **precisa repassar as props injetadas
pelo `ResponsiveContainer`** (`width`, `height`, `style`) para o componente de
gráfico real (`BarChart`/`AreaChart`), do contrário o gráfico mede um
tamanho válido mas nunca renderiza nada (nem erro, nem estado vazio — apenas
uma `div` em branco). Por isso `SimpleBarChart`/`SimpleTrendChart` aceitam
`...responsiveProps` e os espalham no componente do recharts.

## Como testar

- Backend: `npm run test --workspace server` (saúde da infraestrutura) e
  `npm run test:integration --workspace server` (estrutura do endpoint,
  permissão, deltas com dados reais, filtro de período);
- E2E: `npx playwright test tests/e2e/dashboard.spec.js` (indicadores visíveis,
  sem erros de console, filtro de período, navegação a partir de um ranking);
- Visual: `npm run dev:server` + `npm run dev`, logar com
  `admin@itguardian.local` / `123456` e conferir cards, gráficos e rankings
  com o seed de demonstração (`ENABLE_DEMO_SEED=true`).

## Validação para novas métricas

Toda nova métrica precisa de:

1. consulta no backend (reaproveitando serviços existentes quando possível);
2. regra de período documentada;
3. teste com dados e sem dados;
4. verificação de permissão;
5. destino ou filtro válido quando o card for clicável;
6. estado "indisponível" explícito caso a métrica dependa de um dado que ainda
   não é persistido — nunca omitir nem simular.
