# IT Guardian

IT Guardian e um MVP funcional para monitoramento e inventario de infraestrutura de TI. A versao atual foi preparada para duas fases de deploy:

- Fase atual: frontend React e API Express leve no Vercel, usando PostgreSQL externo via Supabase ou Neon.
- Fase futura: backend completo em VPS para ping real, OCS Inventory, Zabbix e jobs continuos dentro da rede da empresa.

## Stack

- Frontend: React, Vite, dnd-kit, Recharts, Lucide
- API leve: Node.js, Express, JWT
- Banco: PostgreSQL externo por `DATABASE_URL`
- Demo/offline: `DATABASE_URL=memory` apenas em desenvolvimento
- Deploy demo/TCC: Vercel + Supabase ou Neon

## Documentacao tecnica

- [Fase 1 - Inventario](docs/FASE-1-INVENTARIO.md)
- [Fase 2 - Ordens de Servico](docs/FASE-2-ORDENS-SERVICO.md)
- [Documentacao completa do codigo](docs/DOCUMENTACAO-CODIGO-COMPLETA.md)
- [Modulo de concursos e simulados](docs/CONCURSOS-SIMULADOS.md)

## Estrutura

```text
it-guardian/
  api/index.js                 Funcao serverless do Vercel
  client/                      React + Vite
  server/src/app.js            Express app sem app.listen()
  server/src/server.js         Entrada local com app.listen()
  server/src/bootstrap.js      Inicializacao idempotente de banco/seeds
  server/src/config/           Ambiente, CORS, DATABASE_URL, JWT
  server/src/controllers/      Controllers HTTP
  server/src/routes/           Rotas HTTP
  server/src/repositories/     Persistencia PostgreSQL
  server/src/services/         Orquestracao de dominio
  server/src/integrations/     Adaptadores mock/reais futuros
  server/src/jobs/             Jobs futuros para VPS
```

## Rodar Localmente

Instale dependencias:

```bash
npm install
```

Crie os arquivos de ambiente:

```bash
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Para usar Postgres local:

```bash
docker compose up db -d
```

Ou, para demo offline sem Postgres, use no `server/.env`:

```env
DATABASE_URL=memory
```

Suba o frontend:

```bash
npm run dev
```

Suba a API local em outro terminal:

```bash
npm run dev:server
```

URLs locais:

- Frontend: http://localhost:5173
- API health: http://localhost:4000/api/health
- WebSocket local: ws://localhost:4000/ws

Conta demo:

```text
email: admin@itguardian.local
senha: 123456
```

A conta demo e os demais dados ficticios sao semeados em desenvolvimento e em deploys
de preview da Vercel. Em producao real, o bootstrap cria a estrutura basica, mas nao
injeta usuarios ou dados operacionais demo, a menos que `ENABLE_DEMO_SEED=true` seja
configurado explicitamente.

Primeiro acesso em producao:

1. Acesse a tela de login.
2. Abra a aba `Cadastro`.
3. Crie o primeiro administrador da instalacao.
4. Depois que existir um administrador ativo, novos cadastros publicos sao bloqueados e os proximos usuarios devem ser criados em Configuracoes Gerais > Admin.

Se tentar entrar em producao com `admin@itguardian.local` sem ter criado esse usuario no banco real, a API retornara `401`, pois essa credencial existe apenas em ambiente demo.

Para liberar contas de teste em um deploy temporario:

```env
ENABLE_DEMO_SEED=true
```

Depois do redeploy, use:

```text
email: admin@itguardian.local
senha: 123456
```

## Deploy no Vercel

1. Suba o repositorio no GitHub.
2. Importe o projeto no Vercel.
3. Use o build command `npm run build`.
4. Use output directory `dist`.
5. Configure as variaveis de ambiente no Vercel.

Variaveis recomendadas:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=uma-chave-grande-e-segura
FRONTEND_URL=https://seu-projeto.vercel.app
PING_MODE=mock
OCS_MODE=mock
ZABBIX_MODE=mock
```

Variaveis de frontend:

```env
VITE_FRONTEND_URL=https://seu-projeto.vercel.app
```

`VITE_API_URL` nao e obrigatoria no Vercel. Em producao, o frontend chama a API por `/api`.

## Banco Supabase ou Neon

O backend usa `DATABASE_URL`. Em producao, a API bloqueia:

- `DATABASE_URL=memory`
- ausencia de `DATABASE_URL`

Supabase e Neon exigem SSL na maior parte dos cenarios. O projeto ativa SSL automaticamente em producao ou quando a URL parecer Supabase/Neon. Se precisar forcar:

```env
DB_SSL=true
```

Tabelas criadas automaticamente no bootstrap:

- `users`
- `sectors`
- `audit_logs`
- `alert_acknowledgements`
- `segment_groups`
- `inventory_segments`
- `device_segments`
- `manual_network_assets`
- `device_metadata`
- `asset_history`
- `service_orders`
- `service_order_history`
- `service_order_items`
- `app_settings`
- `clients`
- `products`
- `service_catalog`
- `technicians`
- `problem_types`
- `priority_rules`

## API e CORS

Local:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000/api`

Vercel:

- Frontend e API no mesmo dominio
- Frontend chama `/api`
- CORS aceita `FRONTEND_URL`, `CLIENT_ORIGIN`, `VERCEL_URL` e localhost em desenvolvimento

## QR Code

Os QR Codes usam a URL publica do frontend:

```text
https://seu-projeto.vercel.app/assets/:assetId
```

Localmente, usam `VITE_FRONTEND_URL` ou `window.location.origin`.

## Limites do Vercel

O Vercel serve bem para demo/TCC, CRUD, login, inventario, segmentos, grupos, ativos manuais, historico e QR Code.

Ping real, OCS Inventory real, Zabbix real e monitoramento continuo precisam de uma VPS ou agente dentro da rede da empresa, porque IPs internos como `10.10.x.x` nao sao acessiveis diretamente pelo Vercel.

## Fase Futura em VPS

Os pontos de troca ja estao isolados:

- `server/src/integrations/ping/PingService.js`
- `server/src/integrations/ocs/OcsInventoryService.js`
- `server/src/integrations/zabbix/ZabbixService.js`
- `server/src/jobs/`

Na VPS, a ideia e alterar `PING_MODE`, `OCS_MODE` e `ZABBIX_MODE` para modos reais e implementar os clientes internos sem reescrever controllers, rotas ou frontend.

## Scripts

```bash
npm run dev          # frontend Vite
npm run dev:server   # API local
npm run dev:client   # frontend Vite
npm run build        # build do frontend para producao
npm run start        # API local em modo start
npm run docker:up    # stack local Docker
npm run docker:down
```

## Fase 1 - Inventario

A Fase 1 consolida o IT Guardian como um inventario tecnico para demonstracao/TCC, com foco em organizacao de ativos, segmentacao e ficha detalhada de maquinas.

Principais recursos estabilizados:

- login e cadastro com JWT;
- dashboard de infraestrutura e alertas mockados;
- inventario por abas/ambientes;
- grupos e segmentos por ambiente;
- segmento especial `Nao organizadas`;
- cadastro manual de ativos de rede;
- maquinas OCS/mockadas e ativos manuais no mesmo inventario;
- drag-and-drop de maquinas, selecao multipla e movimentacao pela sidebar;
- drag-and-drop de segmentos entre grupos;
- busca e filtros por grupo/segmento;
- ficha grande da maquina/ativo com abas internas;
- historico, observacoes e perifericos;
- status de ping mockado/preparado para integracao real;
- fluxo de manutencao com segmento automatico `Manutencao`;
- QR Code individual com impressao em etiqueta Zebra;
- modo claro/noturno.

Detalhes e decisoes da Fase 1 estao em [`docs/FASE-1-INVENTARIO.md`](docs/FASE-1-INVENTARIO.md).

## Fase 2 - Ordens de Servico

A Fase 2 inicia o controle de atendimentos tecnicos dentro do IT Guardian. A primeira entrega cria a base do modulo, mantendo o Inventario como Fase 1 estavel.

Recursos iniciais:

- menu e tela `Ordens de Servico`;
- criacao manual de OS;
- listagem por status: Aberta, Em atendimento, Aguardando e Finalizada;
- vinculo opcional com maquina/ativo do inventario;
- vinculo com ambiente/cliente;
- detalhe da OS com abas internas;
- registro de atendimento, diagnostico, solucao e pecas trocadas em texto simples;
- historico basico da OS;
- regra para exigir tecnico responsavel antes de avancar a OS;
- OS automatica ao colocar maquina em manutencao;
- finalizacao de OS de manutencao retirando a maquina da manutencao;
- tela de Configuracoes com cadastros de clientes, produtos e tecnicos;
- Tipos de Problema e Regras de Prioridade para sugerir urgencia de OS;
- tela publica isolada `/abrir-chamado` para usuario final abrir solicitacao sem acessar o painel;
- importacao CSV inicial para clientes e produtos;
- persistencia em `service_orders` e `service_order_history`.

Detalhes e proximos passos estao em [`docs/FASE-2-ORDENS-SERVICO.md`](docs/FASE-2-ORDENS-SERVICO.md).

## Fase 3 - Preparacao para Implementacao Real

A Fase 3 separa melhor o que deve ficar no frontend e o que deve ser regra do backend. O estado atual ja coloca Ordens de Servico, usuarios, setores, permissoes e configuracoes importantes sob controle da API.

Documentos:

- [`docs/FASE-3-AUDITORIA-TECNICA.md`](docs/FASE-3-AUDITORIA-TECNICA.md)
- [`docs/FASE-3-PLANO-MIGRACAO-BACKEND.md`](docs/FASE-3-PLANO-MIGRACAO-BACKEND.md)
- [`docs/FASE-3-IMPLEMENTACAO-REAL.md`](docs/FASE-3-IMPLEMENTACAO-REAL.md)
- [`docs/FASE-3-CHECKLIST-TESTES.md`](docs/FASE-3-CHECKLIST-TESTES.md)

Resumo tecnico da Fase 3:

- `systemMode` agora e persistido por `/api/system-settings`;
- OS usa backend para numero, status, prioridade, historico, itens e valores;
- usuarios, setores e permissoes sao validados no backend;
- configuracoes de regra da OS usam API e nao dependem mais do navegador;
- status em uso nao pode ser removido sem mover as OS vinculadas;
- servicos possuem codigo unico, valor padrao e prioridade padrao vindos da API;
- seeds demo ficam restritos a ambiente nao produtivo;
- cadastros de OS usam permissao `service_orders.settings`;
- preferencias visuais simples continuam no frontend;
- OCS, Zabbix e ping real continuam planejados para VPS/coletor.

Auditoria final da Fase 3 em 30/05/2026:

- `npm run build` passou;
- smoke test de API validou login/permissoes, settings, OS, servicos, itens, historico e `closed_at`;
- travas de producao bloquearam `DATABASE_URL=memory` e `JWT_SECRET` inseguro;
- o aviso restante e apenas o chunk principal do Vite acima de 500 kB, planejado para code splitting futuro.

## Checklist de Teste Manual

Antes de publicar ou fazer uma entrega, validar:

- entrar com a conta demo ou uma conta cadastrada;
- abrir Dashboard e Inventario;
- criar, renomear, colorir e excluir uma aba;
- criar grupo e segmento;
- criar segmento com mesmo nome em grupos diferentes;
- bloquear nomes reservados de segmento, como `Manutencao` e `Nao organizadas`;
- mover uma maquina entre segmentos;
- selecionar multiplas maquinas e mover em massa;
- mover uma maquina pela sidebar;
- mover um segmento para outro grupo;
- buscar por nome, IP, tipo, marca, modelo, patrimonio e segmento;
- filtrar por grupo e segmento;
- abrir ficha da maquina;
- editar nome fantasia;
- alterar tipo do aparelho;
- abrir e remover periferico;
- adicionar observacao;
- colocar maquina em manutencao e retirar da manutencao;
- imprimir QR Code individual em etiqueta;
- abrir Ordens de Servico;
- criar OS manual;
- vincular OS a uma maquina;
- alterar tecnico/prioridade e salvar atendimento;
- tentar avancar OS sem tecnico e conferir bloqueio;
- mudar status ate Finalizada e verificar historico;
- abrir `/abrir-chamado`, enviar uma solicitacao e conferir a OS em Aberta;
- abrir Configuracoes;
- cadastrar cliente, produto e tecnico;
- cadastrar tipo de problema;
- cadastrar regra simples de prioridade;
- importar clientes/produtos via CSV simples;
- alternar modo claro/noturno;
- testar layout com poucos cards e com muitos cards;
- rodar `npm run build`.

## Endpoints Principais

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/devices`
- `GET /api/devices/:id`
- `GET /api/devices/public/:id`
- `POST /api/devices/manual`
- `PATCH /api/devices/:id/manual`
- `PATCH /api/devices/:id/type`
- `POST /api/devices/:id/ping`
- `PATCH /api/devices/:id/segment`
- `GET /api/segments`
- `POST /api/segments`
- `PATCH /api/segments/:id`
- `DELETE /api/segments/:id`
- `GET /api/segments/groups`
- `POST /api/segments/groups`
- `PATCH /api/segments/groups/:id`
- `DELETE /api/segments/groups/:id`
- `GET /api/alerts`
- `GET /api/alerts/history`
- `POST /api/alerts/:id/acknowledge`
- `DELETE /api/alerts/:id/acknowledge`
- `GET /api/service-orders`
- `GET /api/service-orders/:id`
- `POST /api/service-orders`
- `PATCH /api/service-orders/:id`
- `PATCH /api/service-orders/:id/status`
- `POST /api/service-orders/:id/history`
- `GET /api/public/support-options`
- `POST /api/public/service-orders`
- `GET /api/clients`
- `POST /api/clients`
- `PATCH /api/clients/:id`
- `DELETE /api/clients/:id`
- `POST /api/clients/import`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `POST /api/products/import`
- `GET /api/technicians`
- `POST /api/technicians`
- `PATCH /api/technicians/:id`
- `DELETE /api/technicians/:id`
- `GET /api/problem-types`
- `POST /api/problem-types`
- `PATCH /api/problem-types/:id`
- `DELETE /api/problem-types/:id`
- `GET /api/priority-rules`
- `POST /api/priority-rules`
- `PATCH /api/priority-rules/:id`
- `DELETE /api/priority-rules/:id`
