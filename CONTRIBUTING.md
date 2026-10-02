# Contribuindo

## Preparar o ambiente
```bash
npm ci                       # raiz + workspaces (server, client)
DATABASE_URL=memory ENABLE_DEMO_SEED=true JWT_SECRET=dev-secret-com-pelo-menos-32-caracteres npm run dev:server
npm run dev:client           # Vite em http://localhost:5173
```
`DATABASE_URL=memory` usa o pg-mem (só dev/teste; recusado em produção) e `ENABLE_DEMO_SEED=true` cria os usuários de
demonstração: `admin@itguardian.local` / `123456` (nunca em produção). Com PostgreSQL real: `docker compose up db`
e `DATABASE_URL=postgres://itguardian:itguardian@localhost:5432/itguardian` (copie `server/.env.example` para `server/.env`).

## Antes de abrir um PR
```bash
npm run lint                 # ESLint, 0 avisos
npm run check:architecture   # ciclos, camadas do backend, primitivas proibidas
npm run check:docs           # links, índice de docs e variáveis de ambiente documentadas
npm run test                 # servidor (pg-mem)
npm run test:client          # cliente (vitest)
npm run build
```
Para validar no motor de produção: `TEST_PG_ADMIN_URL=postgres://itguardian:itguardian@127.0.0.1:54329/postgres npm run test --workspace server`
(um PostgreSQL local qualquer com esse usuário). O CI roda a suíte nos dois bancos. Testes e2e: `npm run test:e2e`
(Playwright; usa as portas 4100/5174).

## Regras que o CI faz cumprir
- **Migrações**: mudança de esquema é uma migração numerada e idempotente em `server/src/migrations/`, registrada em
  `index.js`. **Nunca** edite `server/src/schema/legacy/*` (congelado por teste de hash). Somente-avante; veja
  [docs/MIGRACOES.md](docs/MIGRACOES.md).
- **Camadas do backend**: `domain` (puro) → `repositories` (SQL) → `services` → `controllers` → `routes`. Veja
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Toda rota nova** precisa de autenticação e permissão; a matriz de autorização falha se uma rota ficar sem.
- **Variável de ambiente nova** entra em `server/.env.example` (com comentário).
- **Testes de integração** usam `await useTestDatabase()` (`server/test-support/database.mjs`) e sessões reais
  (`startSession`), nunca JWT forjado. Devem passar em pg-mem **e** PostgreSQL real.
- **Sem recursos externos no cliente** (CSP): nada de CDN, fonte ou script de terceiros.
- **Segredos** nunca em código, logs ou testes; use `.env` local (ignorado pelo git).
- Textos da interface em português com acentuação correta.

## Commits e PRs
Mensagens no imperativo, em português, com escopo (`feat(db): ...`, `fix(auth): ...`, `test: ...`). PRs pequenos e
focados; descreva o porquê, os riscos e como foi validado. Mudanças em autenticação, execução remota, agente ou build
exigem atualizar o [modelo de ameaças](docs/MODELO-DE-AMEACAS.md).

## Segurança
Vulnerabilidades: veja [SECURITY.md](SECURITY.md) (não abra issue pública).
