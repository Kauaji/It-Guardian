# CLAUDE.md — IT Guardian

Gestão de infraestrutura de TI com coletor/agente nativo para Windows. Responda e commite em **português**.
O dono do projeto não usa terminal/git no dia a dia: quem commita, dá push e roda comandos é o Claude.

## Stack
- **client/**: React 19 + Vite; testes com Vitest (jsdom); e2e com Playwright (`tests/e2e`, `@axe-core/playwright`).
- **server/**: Express 4 + PostgreSQL (`pg-mem` nos testes e em dev); testes com `node:test`.
- **Raiz**: npm workspaces (`server`, `client`), ESLint, Prettier (printWidth 140), `tsc --noEmit` (checkJs).
- **agent/windows/**: agente em C#/PowerShell. **installers/**: instalador Inno Setup. **shared/**, **api/**, **ops/**, **docs/**.
- **Deploy**: Vercel (projeto `it-guardian-server`). Branch ≠ `main` gera *preview*; `main` gera **PRODUÇÃO**.
- CI roda em **Node 22** (`ci.yml`, `security.yml`; Dockerfiles também). Não há `engines`/`.nvmrc`. Evite mexer em `engines` (a Vercel lê).

## Comandos úteis (rodar na raiz)
| Para quê | Comando |
|---|---|
| Instalar (igual ao CI) | `npm ci` |
| Dev servidor (pg-mem + demo) | `DATABASE_URL=memory ENABLE_DEMO_SEED=true JWT_SECRET=<32+ chars> npm run dev:server` |
| Dev cliente (http://localhost:5173) | `npm run dev:client` |
| Testes servidor / com cobertura | `npm test` / `npm run test:coverage` |
| Testes cliente / com cobertura | `npm run test:client` / `npm run test:client:coverage` |
| e2e (portas 4100/5174/5175) | `npm run test:e2e` |
| Build + orçamento de bundle | `npm run build` e `npm run check:bundle` |
| Estáticos | `lint`, `format:check` (`npm run format` corrige), `typecheck`, `check:architecture`, `check:docs`, `check:env`, `check:workflows`, `check:contrast`, `check:accents` |
| Funções ≤150 linhas, arquivos ≤700 | `node scripts/function-lengths.mjs --over 150 --fail-over 150 --fail-file 700 server/src client/src` |
| Testes dos scripts | `node --test scripts/*.test.mjs` |
| Migrações | `npm run db:migrate` / `npm run db:status -- --check` |
| Chaves do agente / assinatura | `npm run agent:keys` / `npm run agent:sign-release` |
| Agente Windows / instalador | `npm run agent:test` / `npm run installer:windows` |

`npm run check` é um atalho parcial (não inclui `format:check`, `check:workflows`, `check:env` nem a catraca de funções).

## Regras críticas (não negociáveis)
1. **Pool de banco = 1 conexão na Vercel** (`DB_POOL_MAX=1`). Nunca segure uma conexão do pool (transação aberta, advisory lock,
   `client` dedicado) enquanto faz outras queries: já causou deadlock e 500 no login em produção.
   Regressão coberta por `server/test-integration/single-connection-pool.test.mjs`.
2. **Schema legado congelado** (`server/src/schema/legacy/*`, teste de hash `legacySchemaFrozen.test.mjs`). Mudança de banco =
   migração numerada, idempotente, forward-only em `server/src/migrations/` (registrar em `index.js`). Veja `docs/MIGRACOES.md`.
3. **Camadas** validadas por `scripts/check-architecture.mjs`: `domain` (puro) → `repositories` (SQL) → `services` → `controllers`
   → `routes`. Funções ≤150 linhas, arquivos ≤700. Proibido `child_process`/`exec`/`spawn`/`eval` no servidor.
4. **CSP estrita**: `vercel.json` e `client/nginx.conf` devem ter os mesmos cabeçalhos (`securityHeadersParity.test.mjs`).
   Sem CDN, fonte ou script de terceiros no cliente.
5. **Orçamento de bundle** (`scripts/check-bundle-budget.mjs`). Não suba o limite sem justificar no mesmo commit.
6. **`NODE_ENV=test` só em jobs/passos de teste.** No `build` ele empacota o React em modo dev (+60 kB gzip) e estoura o bundle.
7. Nunca pule, desative ou comente teste para ficar verde. Nunca use `--force` nem `--no-verify`.
8. Nunca commite segredos (`.env`, chaves, tokens). Toda env nova entra em `server/.env.example` (com comentário).
9. Toda rota nova exige autenticação + permissão. Textos da UI em português **com acentos**. Testes de integração usam
   `await useTestDatabase()` e sessões reais, e devem passar em pg-mem **e** PostgreSQL real.

## Fluxo de trabalho
1. `git checkout -b <tipo>/<assunto>` a partir de `main` atualizada. **Nunca push direto na `main`.**
2. Commits pequenos, no imperativo, com escopo: `fix(db): ...`, `test(plantas): ...`, `ci: ...`.
3. `git push -u origin <branch>` e passar ao dono o link:
   `https://github.com/Kauaji/It-Guardian/compare/<branch>?expand=1`. O merge é feito por ele no navegador.
4. Acompanhar o CI do PR (Actions) e corrigir até ficar verde. Antes de ação arriscada (push, apagar, config de deploy), dizer em uma linha.

## Validar antes do push
Rode nesta ordem e leia o erro real (não só o código de saída):
```bash
npm run lint && npm run format:check && npm run typecheck && npm run check:architecture
npm run check:docs && npm run check:env && npm run check:workflows && npm run check:contrast && npm run check:accents
node scripts/function-lengths.mjs --over 150 --fail-over 150 --fail-file 700 server/src client/src
NODE_ENV=test JWT_SECRET=<32+ chars> npm run test:coverage   # servidor
npm run test:client:coverage && npm run build && npm run check:bundle
```
Mudou dependência? `npm audit --omit=dev --audit-level=high` precisa sair 0. Mudou banco? Rode também com `TEST_PG_ADMIN_URL`
apontando para um PostgreSQL (veja `CONTRIBUTING.md`).

## Armadilhas conhecidas
- **Windows**: `.gitattributes` força LF. Sem isso o Git grava CRLF e `format:check` falha só localmente. Em scripts `.mjs`
  use `fileURLToPath(import.meta.url)`, nunca `new URL(...).pathname`.
- **Testes de UI**: efeitos (`useEffect`) rodam depois do commit; asserções sobre URL/estado derivado de efeito usam `waitFor`.
  Isolado passa, mas a suíte inteira em paralelo (CI) expõe a corrida.
- Mais contexto: `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `docs/MIGRACOES.md`, `docs/PERFORMANCE-FRONTEND.md`.
