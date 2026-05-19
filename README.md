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
senha: admin123
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
- `audit_logs`
- `alert_acknowledgements`
- `segment_groups`
- `inventory_segments`
- `device_segments`
- `manual_network_assets`
- `device_metadata`
- `asset_history`

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
