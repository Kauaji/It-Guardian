# 0002 — Migrações somente-avante e esquema legado congelado

**Estado:** aceito

## Contexto
O esquema inicial era uma função única de 1.800 linhas reexecutada a cada partida, e novas mudanças eram enxertadas nela.

## Decisão
O legado vira módulos por domínio, executado uma vez por banco (marcador em `schema_migrations`) e **congelado** por teste
de hash. Mudanças novas são migrações numeradas, idempotentes e somente-avante (*expand → migrate → contract*). O servidor
tem `MIGRATIONS_MODE=auto|check|skip` e há CLI `db:migrate` / `db:status`.

## Consequências
- (+) Cold start sem ~250 DDLs; mudanças de esquema revisáveis e testáveis; deploy com etapa de migração separada.
- (−) Sem `down`: reverter exige código compatível com o esquema novo (ver [MIGRACOES.md](../MIGRACOES.md)).
