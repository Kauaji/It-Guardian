# Arquitetura do IT Guardian

## Visao geral

O projeto usa um workspace npm com:

- `client`: React e Vite;
- `server`: Express e PostgreSQL, com `pg-mem` somente para desenvolvimento e testes;
- `tests/e2e`: fluxos de navegador com Playwright;
- `server/test-integration`: validacao de migracoes em PostgreSQL real.

## Topologia cloud e local

- Na Vercel, o frontend e a API Express compartilham o mesmo dominio por meio de
  `api/index.js` e das regras em `vercel.json`.
- PostgreSQL gerenciado e obrigatorio em producao; Supabase e Neon sao opcoes,
  nao dependencias de dominio.
- Ativacao e heartbeat do coletor sao requisicoes HTTP curtas e compativeis com
  funcao serverless.
- OCS, Zabbix, polling de LAN e jobs persistentes exigem um processo sempre
  ligado com acesso a rede interna.
- O perfil Docker/local permanece a topologia indicada para instalacoes dentro
  da empresa sem dependencia de cloud.

O runbook detalhado esta em
[`CLOUD-COLLECTOR-E-LICENCIAMENTO.md`](CLOUD-COLLECTOR-E-LICENCIAMENTO.md).

## Fronteiras principais

- O backend e a fonte da verdade para autenticacao, permissoes, inventario, OS, alertas, preventivas, automacoes e preferencias.
- Componentes React exibem estado e chamam funcoes de `client/src/api.js`.
- A persistencia local nao substitui dados de negocio.
- Scripts de manutencao sao cadastrados e analisados, mas nunca executados pelo servidor ou navegador.

## Organizacao do frontend

- `App.jsx`: composicao global, sessao e navegacao.
- `components/alerts`: central de avisos e utilitarios.
- `components/automation`: automacao preventiva.
- `components/inventory`: inventario e ativos.
- `components/serviceOrders`: fluxo de Ordens de Servico.
- `components/ui`: estados e componentes visuais compartilhados.
- `hooks`: comportamento reutilizavel de interface.
- `utils`: formatacao e funcoes puras.

## Organizacao do backend

- `controllers`: traducao HTTP.
- `routes`: endpoints e permissoes.
- `services`: regras de negocio compartilhadas.
- `repositories`: consultas e transacoes.
- `migrations`: evolucao incremental do banco.
- `schema/legacyBootstrap.js`: compatibilidade temporaria com o esquema historico.
- `middleware`: autenticacao, origem CSRF, rate limit, contexto e erros.
- `security`: cookie de sessao e primitivas de seguranca.

## Camadas do backend

O codigo de `server/src` segue tres camadas de negocio, com o padrao ja usado em
scripts de manutencao, preventivas/automacao, ordens de servico, avisos, mapas e
assistencia remota: **dominio** (regras puras) / **repositorio** (so SQL e
mapeamento) / **servico** (orquestracao e transacoes). Um arquivo antigo grande
vira barril de reexportacao (`export * from`) apenas quando outros modulos ainda
o importam.

| Camada | Pasta | Responsabilidade | Pode importar | Nao pode importar |
| --- | --- | --- | --- | --- |
| Dominio | `domain/**` | Regras puras: normalizacao, calculo, decisao, montagem de linhas/payloads. Recebe os dados prontos e devolve resultado. `node:crypto` e permitido. | `domain`, `lib`, `permissions.js`, `node:crypto` | `repositories`, `services`, `controllers`, `routes`, `middleware`, `database.js`, `config/environment.js`, `node:fs`, `node:net`, `node:http(s)`, `node:child_process` |
| Repositorio | `repositories/**` | Consultas SQL e mapeamento de linhas (`fromRow`). Recebe `db` (transacao) quando o chamador a controla. Sem regra de negocio e sem chamadas de rede. | `domain`, `database.js`, outros repositorios | `services`, `controllers`, `routes`, `middleware` |
| Servico | `services/**` | Orquestracao: valida, chama dominio e repositorios, abre transacoes, grava logs e historico, dispara notificacoes. | `domain`, `repositories`, `config`, `integrations` | `controllers`, `routes`, `middleware` |
| Controller | `controllers/**` | Traducao HTTP (entrada, status, resposta). | `services`, `domain` (tipos/validacoes) | `repositories` (sempre via servico) |

Regras praticas:

- dependencias de ambiente (`config/environment.js`, `process.env`) e de rede
  (ping, TURN, fila de relay) ficam em servicos; o dominio recebe o valor ou a
  funcao por parametro (ex.: `buildAgentAlerts(asset, now, { offlineAfter... })`,
  `createManualAsset({ ..., checkPing })`);
- um repositorio nao chama servico. Se uma funcao mistura SQL e decisao, a
  decisao vai para o dominio (funcao pura testavel) e a orquestracao para um
  servico fino;
- fachadas que juntam dominio, repositorio e servico para importadores antigos
  moram em `services/` (`maintenanceScriptsFacade.js`, `preventiveAutomationFacade.js`,
  `floorPlanService.js`, `remoteAssistanceService.js`), nunca em `repositories/`;
- meta de tamanho: nenhuma funcao acima de 150 linhas e nenhum arquivo acima de
  700 linhas em `server/src` (exceto barris, migracoes, `schema/legacy` congelado e
  testes). `node scripts/function-lengths.mjs server/src` lista os que passaram
  do limite; `--fail-over 150 --fail-file 700` falha quando houver algum.

Onde cada area fica (dominio / repositorio / servico):

| Area | `domain/` | `repositories/` | `services/` |
| --- | --- | --- | --- |
| Ordens de servico | `serviceOrders/*` (configuracoes, SLA, prioridade, itens, acesso, linhas, ciclo de vida, anexos, avaliacao) | `serviceOrders/*` + barril `serviceOrderRepository.js` (leitura) | `serviceOrders/*` (criacao, atualizacao, status/reabertura/exclusao, avaliacao, anexos, numeracao, jobs de SLA e prioridade) |
| Avisos e sugestoes | `alerts/*` (configuracao, catalogo, insights, avisos do agente) | `alerts/*` + barril `alertRepository.js` | `alerts/*` (criacao de sugestao, observacao, enriquecimento, sincronizacao) + `alertService.js` |
| Plantas | `floorPlans/*` | `floorPlans/*` | `floorPlans/*` + fachada `floorPlanService.js` |
| Mapa visual 3D | `inventoryVisualMap/*` | `inventoryVisualMap/*` | `inventoryVisualMap/*` + `inventoryVisualMapService.js` |
| Mapa de rede | `networkTopology/*` | `networkTopology/*` | `networkTopology/*` + `networkTopologyService.js` |
| Assistencia remota | `remoteAssistance/*` + `remoteAssistancePolicy.js` | `remoteAssistanceRepository.js` | `remoteAssistance/*` + fachada `remoteAssistanceService.js` |
| Scripts e jobs do agente | `maintenanceScripts/*`, `agentScriptJobs.js` | `maintenanceScripts/*`, `agentScriptJobs/*` | `maintenanceScripts/*`, `agentScriptJobService.js`; fachada `maintenanceScripts/maintenanceScriptsFacade.js` |
| Preventivas e automacao | `preventive*.js`, `preventiveAutomation*.js` | `preventive*Repository.js` | `preventive*Service.js`; fachada `preventiveAutomationFacade.js` |
| Dados de demonstracao | - | `demo/*` (inventario, catalogo, OS, usuarios) | - |

### Verificacao automatica

`npm run check:architecture` (`scripts/check-architecture.mjs`) falha o CI, com
mensagem indicando arquivo, import e camada, quando:

1. ha ciclo de dependencia entre modulos locais (cliente e servidor);
2. o servidor usa `child_process`, `exec`, `spawn`, `eval` ou `new Function`;
3. um modulo de `server/src` importa o que a sua camada nao pode importar
   (tabela acima; vale tambem para `import()` dinamico; arquivos `*.test.*` ficam
   fora da regra).

Quando uma violacao existente for grande demais para corrigir de imediato, ela
entra em `knownViolations` no proprio script (`{ file, import }`). A lista e
validada nos dois sentidos: violacao nova fora da lista falha, e excecao
obsoleta (a violacao deixou de existir) tambem falha, para a lista so poder
encolher. Hoje a lista esta vazia (0 excecoes). Os testes do script
(`scripts/check-architecture.test.mjs`, incluidos na suite do servidor por
`server/test/architectureScript.test.mjs`) montam arvores temporarias que
demonstram violacao detectada e excecao aceita.

## Regras de evolucao

1. Nova regra de negocio deve nascer no backend e receber teste.
2. Nova alteracao de esquema deve ser uma migracao idempotente.
3. Componentes acima de aproximadamente 600 linhas devem ser avaliados para extracao por responsabilidade.
4. Nenhum dado sensivel deve ser armazenado em Web Storage.
5. Nenhum modulo do servidor pode executar comandos do sistema operacional.
6. Toda entrega deve passar por `npm run check`, `npm run test:e2e` e `npm audit`.

`npm run check:architecture` bloqueia ciclos entre modulos locais e o uso de
primitivas de execucao de comandos no servidor.

## Divida tecnica priorizada

1. Dividir `AlertCenterV2.jsx` por Sugestoes, Preventivas, Configuracoes e detalhes.
2. Reduzir `App.jsx` movendo hidratacao de dominios para hooks especificos.
3. Separar `styles.css` por dominio sem alterar a cascata.
4. Converter o bootstrap legado em migracoes historicas versionadas.
5. Ampliar testes de API e PostgreSQL real na CI.
