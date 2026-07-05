# Arquitetura do IT Guardian

## Visao geral

O projeto usa um workspace npm com:

- `client`: React e Vite;
- `server`: Express e PostgreSQL, com `pg-mem` somente para desenvolvimento e testes;
- `tests/e2e`: fluxos de navegador com Playwright;
- `server/test-integration`: validacao de migracoes em PostgreSQL real.

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
