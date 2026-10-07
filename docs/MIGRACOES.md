# Migrações de banco

## Como o esquema nasce

1. **Esquema legado congelado** (`server/src/schema/legacy/*`): o que existia antes das migrações numeradas
   (~250 DDLs, 11 módulos por domínio). Roda **uma vez por banco**; ao terminar grava o marcador
   `000-legacy-schema-frozen` em `schema_migrations` e as próximas partidas o pulam. Um advisory lock impede duas
   instâncias frias de executarem DDL ao mesmo tempo.
2. **Migrações numeradas** (`server/src/migrations/NNN-nome.js`, registradas em `migrations/index.js`): aplicadas em
   ordem, cada uma dentro da transação do runner com advisory lock; o id fica em `schema_migrations`.

O teste `legacySchemaFrozen.test.mjs` guarda um hash do legado: editar esses arquivos falha o CI, porque a mudança
**não alcançaria nenhum banco existente** (o marcador já foi gravado). Toda mudança de esquema nova é uma migração.

## Política: somente-avante (forward-only)

- Não existe `down`. Reverter um deploy significa subir o código anterior **contra o esquema novo**; por isso toda
  migração precisa ser compatível com a versão imediatamente anterior do código (padrão *expand → migrate → contract*):
  1. **Expandir**: adicionar colunas/tabelas/índices (nullable ou com default), sem remover nada que o código atual use.
  2. **Migrar**: o código novo passa a usar o novo formato; backfill em lotes quando necessário.
  3. **Contrair**: só em uma migração **posterior** (depois de o código antigo não existir mais em nenhum ambiente)
     remover colunas/tabelas obsoletas.
- Migrações precisam ser **idempotentes** (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
- Nunca edite uma migração já publicada; corrija com uma nova.
- Operações que travam tabelas grandes (`CREATE INDEX` sem `CONCURRENTLY`, `ALTER ... TYPE`) devem ser avaliadas contra
  o tamanho real de `agent_heartbeats`/`asset_metric_history`; a retenção de dados mantém essas tabelas pequenas.
- O prefixo duplicado `025` (`025-report-exports` e `025-asset-metric-history`) já foi aplicado em bancos reais e está
  **grandfathered**: o teste `migrations.test.mjs` aceita só esse. Prefixos novos precisam ser únicos e crescentes.
- Todo arquivo de migração precisa estar registrado em `migrations/index.js` (o teste compara pasta × registro).

## Operação

| Comando | O que faz |
|---|---|
| `npm run db:status` | Lista o esquema legado e cada migração (aplicada/pendente). |
| `npm run db:status -- --check` | Igual, mas sai com código 1 se algo estiver pendente (gate de pipeline). |
| `npm run db:migrate` | Aplica esquema legado (se faltar) e todas as migrações pendentes. |

`MIGRATIONS_MODE` controla o que o servidor faz ao subir:

- `auto` (padrão): aplica o que faltar. Adequado a dev, Vercel e instalações pequenas.
- `check`: **não altera nada**; recusa subir com mensagem clara se faltar migração. Use quando o deploy roda
  `npm run db:migrate` como etapa própria (recomendado em produção com várias réplicas).
- `skip`: não toca no esquema (banco gerenciado por outra ferramenta). `/health/ready` reporta `migrations: skipped`.

## Testar uma migração

A suíte de integração roda em dois motores: **pg-mem** (padrão, rápido) e **PostgreSQL real**
(`TEST_PG_ADMIN_URL=postgres://itguardian:itguardian@127.0.0.1:54329/postgres`, um banco isolado por arquivo de teste;
veja `server/test-support/database.mjs`). O pg-mem aceita menos SQL do que o PostgreSQL (ex.: não suporta
`CREATE TABLE IF NOT EXISTS` sobre tabela existente, nem `= ANY($1)` com array); **o PostgreSQL real é a verdade**.
Toda migração nova deve passar nos dois.
