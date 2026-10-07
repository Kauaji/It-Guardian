# Observabilidade e operação

Este documento descreve o que o servidor expõe para ser monitorado e o que fazer quando um alerta dispara.
As regras de alerta vivem em [`ops/prometheus/alerts.yml`](../ops/prometheus/alerts.yml); um teste
(`server/src/lib/alertRules.test.mjs`) garante que toda métrica citada existe e que todo alerta aponta para uma
seção deste arquivo.

## O que o servidor expõe

| Recurso | Onde | Observação |
|---|---|---|
| Logs estruturados (JSON, uma linha por evento) | stdout | Nível por `LOG_LEVEL` (`debug`/`info`/`warn`/`error`). Segredos, tokens, senhas e a query string são redigidos; `/track/<token>` vira `/track/[redigido]`. |
| `requestId` | cabeçalho `x-request-id` e campo `requestId` em todo log e em todo corpo de erro | Aceita um id do cliente apenas se casar `^[A-Za-z0-9._-]{8,64}$`; senão gera um UUID. É a chave para ligar a reclamação de um usuário ao log. |
| Métricas Prometheus | `GET /metrics` com `Authorization: Bearer $METRICS_TOKEN` | Sem `METRICS_TOKEN` a rota **não existe** (404). |
| Liveness | `GET /health/live` | Só diz que o processo responde; nunca toca no banco (uma queda do banco não deve reiniciar o app). |
| Readiness | `GET /health/ready` (e `/health`, `/api/health`) | 200 só com banco acessível **e** migrações aplicadas (respeita `MIGRATIONS_MODE=skip`). |
| Diagnóstico | `GET /api/system/diagnostics` (admin autenticado) | Versão do Node, modo/TLS do banco, pool, checagens, canais de erro configurados. Nada de segredo. |
| Erros 5xx | Sentry (`SENTRY_DSN`) e/ou webhook (`ERROR_WEBHOOK_URL`) | Envelope compatível com Sentry; com taxa limitada para não inundar o canal. |
| Hooks de processo | `unhandledRejection` / `uncaughtException` | Rejeição não tratada: registra, reporta e o processo segue. Exceção não capturada: registra, reporta (até 2 s) e **encerra com código 1** para o supervisor reiniciar. |

### Métricas

| Métrica | Tipo | Rótulos |
|---|---|---|
| `itguardian_http_requests_total` | counter | `method`, `route` (padrão da rota, nunca o caminho cru), `status` |
| `itguardian_http_request_duration_seconds` | histogram | `method`, `route` |
| `itguardian_auth_events_total` | counter | `event` (`auth`, `auth_login_failed`, `auth_lockout`, `auth_logout`, `auth_password_changed`, `auth_recovery_code_used`...) |
| `itguardian_rate_limit_rejections_total` | counter | `limiter` |
| `itguardian_rate_limit_store_errors_total` | counter | — |
| `itguardian_errors_total` | counter | `class` (`4xx`/`5xx`) |
| `itguardian_db_pool_connections` | gauge | `state` (`total`, `idle`, `waiting`) |
| `itguardian_process_uptime_seconds`, `itguardian_process_resident_memory_bytes`, `itguardian_nodejs_heap_used_bytes`, `itguardian_nodejs_eventloop_lag_p99_seconds` | gauge | — |

Exemplo de `scrape_config`:

```yaml
scrape_configs:
  - job_name: it-guardian
    metrics_path: /metrics
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/it-guardian-token
    static_configs:
      - targets: ["api.exemplo.local:4000"]
rule_files:
  - /etc/prometheus/rules/it-guardian-alerts.yml   # copie ops/prometheus/alerts.yml
```

Em Vercel (serverless) não há processo longo para raspar: use os logs da plataforma (JSON) e o canal de erros
(Sentry/webhook); `/metrics` é pensado para a implantação on-premises (Docker/nginx).

## Retenção de dados

Um job diário apaga em lotes (`RETENTION_BATCH_SIZE`) o que passou do prazo: heartbeats do agente
(`RETENTION_HEARTBEAT_DAYS`, 30), histórico de métricas (`RETENTION_METRIC_HISTORY_DAYS`, 90), sessões de login
expiradas/revogadas (`RETENTION_AUTH_SESSION_DAYS`, 30), tokens de reautenticação não usados
(`RETENTION_REAUTH_DAYS`, 7), tentativas de reautenticação (`RETENTION_REAUTH_ATTEMPT_DAYS`, 180) e, opcionalmente,
logs de auditoria (`RETENTION_AUDIT_LOG_DAYS`, 0 = nunca). Tokens de reautenticação referenciados pela auditoria da
assistência remota **nunca** são apagados. Um advisory lock impede duas instâncias de limparem ao mesmo tempo.

- Servidor persistente: agendador interno (primeira execução 5 min após subir, depois a cada 24 h).
- Vercel: cron em `vercel.json` chama `/api/maintenance/retention/cron` com `Authorization: Bearer $CRON_SECRET`
  (sem `CRON_SECRET` a rota responde 503 e fica desativada).
- O resumo (linhas removidas por tabela) sai no log `data_retention_completed`.

## Runbook

### API fora do ar

1. `GET /health/live` responde? Se não, o processo caiu: veja o log do contêiner/serviço (`docker logs it-guardian-api`)
   e procure `uncaughtException` / `unhandledRejection`.
2. Se `live` responde e `ready` não: é o banco ou migração (seção abaixo). `GET /health/ready` mostra
   `checks.database` e `checks.migrations`.
3. `migrations: pending` após um deploy: rode `npm run db:status` e `npm run db:migrate` (ou suba com
   `MIGRATIONS_MODE=auto`). Com `MIGRATIONS_MODE=check` o app recusa subir enquanto faltar migração — é intencional.
4. Banco inacessível: confira credenciais (`28P01`), existência do banco (`3D000`) e rede/TLS (`DB_SSL_MODE`,
   `DB_SSL_CA`). O log `readiness_database_failed` traz a causa.

### Taxa alta de erros 5xx

1. Filtre os logs por `"level":"error"` e `"event":"request_error"`; agrupe por `path`/`code`.
2. Use o `requestId` do corpo do erro (o usuário vê) para achar a pilha exata (fora de produção a pilha vai no log;
   em produção, no Sentry).
3. Erros logo após deploy: compare com a versão anterior (`APP_VERSION`) e considere reverter. Migrações são
   somente-avante (veja [ARCHITECTURE.md](ARCHITECTURE.md)): reverter o código exige que ele continue compatível com o
   esquema novo.
4. Erro de banco (`Erro ao conectar ao banco de dados.`) → seção "Pool do banco saturado".

### Latência alta

1. Veja qual `route` concentra o p95: `histogram_quantile(0.95, sum by (le, route) (rate(itguardian_http_request_duration_seconds_bucket[5m])))`.
2. `itguardian_nodejs_eventloop_lag_p99_seconds` alto indica trabalho síncrono pesado no processo (JSON gigante, laço
   longo); baixo indica espera de I/O (banco/serviço externo).
3. Cheque o pool (`itguardian_db_pool_connections{state="waiting"}`) e consultas lentas no PostgreSQL
   (`pg_stat_activity`, `pg_stat_statements`).
4. Rotas de relatório/inventário com muitos ativos são as candidatas habituais; a retenção de heartbeats mantém as
   tabelas de série temporal pequenas — confirme que o job de retenção está rodando (`data_retention_completed`).

### Pool do banco saturado

`itguardian_db_pool_connections{state="waiting"} > 0` por minutos significa que há mais requisições do que conexões.

1. Aumente `DB_POOL_MAX` **somente** se o PostgreSQL tiver `max_connections` sobrando (em serverless, cada instância
   tem seu pool: prefira o *pooler* do provedor, p. ex. a porta de pooling do Supabase).
2. Procure transações longas ou travadas: `SELECT pid, state, query_start, query FROM pg_stat_activity WHERE state <> 'idle' ORDER BY query_start;`.
3. Verifique se há um deploy recente com consulta nova sem índice.

### Pico de falhas de login

`auth_login_failed` em alta e/ou `auth_lockout` indicam tentativa de força bruta ou usuário esquecido.

1. Veja os logs de auditoria (`audit_logs`, tipos `auth_login_failed` / `auth_lockout`) — o IP e o user-agent ficam no
   `meta`. O bloqueio é progressivo (60 s → 5 min → 15 min → 1 h) e por conta; o limitador de rota restringe por IP.
2. Se vier de poucos IPs, bloqueie no proxy/WAF. Se for distribuído (várias contas, muitos IPs), ligue
   `MFA_REQUIRED_FOR_ADMINS=true` e avise os administradores.
3. Um usuário legítimo bloqueado: o bloqueio expira sozinho; um administrador pode redefinir a senha
   (`POST /api/users/:id/reset-password`).
4. Suspeita de credencial vazada: o administrador redefine a senha do usuário (isso revoga todas as sessões) e,
   se o MFA pode estar comprometido, redefine também o MFA.

### Limitador de taxa

- `itguardian_rate_limit_rejections_total` sustentado: identifique o `limiter` e o cliente. Agentes legítimos têm
  limite por token; um agente com intervalo curto demais pode estourá-lo.
- `itguardian_rate_limit_store_errors_total > 0`: o armazenamento compartilhado (Upstash/Redis) falhou e o limitador
  **liberou** as requisições (falha aberta) — em Vercel sem Redis cada instância conta sozinha. Restaure
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` e confira o serviço.
- Limites configuráveis: `API_RATE_LIMIT_PER_MINUTE`, `API_MUTATION_RATE_LIMIT_PER_MINUTE`,
  `API_ANONYMOUS_RATE_LIMIT_PER_MINUTE`, `API_ANONYMOUS_MUTATION_RATE_LIMIT_PER_MINUTE`, `AUTH_RATE_LIMIT_MAX`.

## Variáveis de ambiente

Todas estão documentadas em [`server/.env.example`](../server/.env.example); o script `npm run check:env` falha o
CI se o servidor ler uma variável que não esteja lá.
