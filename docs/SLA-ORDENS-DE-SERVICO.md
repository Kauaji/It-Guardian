# SLA de Ordens de Servico

## Objetivo

Dar as Ordens de Servico um prazo de atendimento real por prioridade, com
alerta de proximidade do vencimento e deteccao de OS vencidas - sem exigir
mudanca em nenhum fluxo existente (setor, catalogo, prioridade automatica por
tempo, integracao com alertas/preventivas).

## Como o prazo e calculado

`sla_due_at` e calculado **uma unica vez**, no momento em que a OS e criada
(`createServiceOrder`), a partir da prioridade e das horas configuradas para
essa prioridade em `service_order_settings.sla`:

```
sla_due_at = created_at + horas_configuradas[prioridade]
```

Se a prioridade escala automaticamente (recurso ja existente de
`autoPriority`/`getTimedPriority`), o job agendado que persiste essa escala
(`syncAutoPriorities`, disparado pelo cron externo) tambem recalcula
`sla_due_at` a partir da nova prioridade - sem isso, uma OS que escalou de
Baixa para Critica manteria um prazo de 72h calculado quando ainda era Baixa.

## Status de SLA (computado na leitura, nunca persistido)

O status de SLA (`on_track` / `near_due` / `breached` / `resolved` /
`not_applicable`) e sempre **computado no momento da leitura** a partir de
`sla_due_at`, o mesmo principio ja usado pela prioridade automatica por
tempo (`withDisplayPriority`): nunca grava nada em uma requisicao `GET`.

| Status | Quando acontece |
|---|---|
| `not_applicable` | A OS nao tem `sla_due_at` (prioridade sem prazo configurado, ou OS antiga anterior a esta rodada). |
| `on_track` | Ainda falta bastante tempo para o prazo. |
| `near_due` | Falta pouco tempo - ver regra abaixo. |
| `breached` | O prazo ja passou (ou `sla_breached_at` ja foi persistido pelo job). |
| `resolved` | A OS foi finalizada dentro do prazo. |

### Regra de "proxima do vencimento"

Uma OS aberta entra em `near_due` quando **qualquer uma** das duas condicoes
for verdadeira:

1. o tempo restante e menor ou igual a `nearDuePercent`% do prazo total da
   prioridade (padrao: 20%);
2. a prioridade e Alta ou Critica **e** restam menos de `nearDueMinHours`
   horas (padrao: 2h) - garante um alerta minimo mesmo em prazos curtos
   (ex.: Critica com 4h de prazo, onde 20% seriam so 48 minutos).

Prioridades Baixa/Media nao participam da regra de horas minimas - so a
percentual.

## SLA vencido (persistido pelo cron, nunca em uma leitura)

`sla_breached_at` e a unica marca de "vencido" realmente gravada no banco -
e escrita **uma unica vez** (guardada por `IS NULL`) pela funcao
`syncSlaBreaches()`, que roda exclusivamente dentro do job agendado
`processScheduledMaintenanceTasks()` (o mesmo cron externo secreto que ja
persiste a prioridade automatica). Isso garante:

- que o status "vencida" sempre aparece corretamente em qualquer leitura
  (calculado ao vivo a partir de `sla_due_at`), mesmo antes do cron rodar;
- que o evento discreto no historico e no Prontuario Tecnico do ativo
  (`sla_breached` / `service_order_sla_breached`) so e criado uma vez, no
  momento em que o job detecta o vencimento - nao a cada leitura.

Reabrir uma OS (ver abaixo) limpa `sla_breached_at` e recalcula `sla_due_at`
a partir de agora, ja que a OS reaberta ganha um prazo novo.

## Configuracao

Aba **SLA (prazo de atendimento)** dentro de Configuracoes > Ordens de
Servico > Geral:

| Campo | Padrao |
|---|---|
| Baixa | 72h |
| Media | 48h |
| Alta | 24h |
| Critica | 4h |
| Alerta de proxima do vencimento (%) | 20% |
| Ou quando restarem menos de (horas) | 2h |
| Exigir checklist tecnico completo para finalizar | desligado |

## Integracoes

- **Dashboard**: `overview.overdueServiceOrders`/`nearDueServiceOrders` e
  `serviceOrders.overdue` usam o mesmo calculo - ver [DASHBOARD.md](DASHBOARD.md).
- **Prontuario Tecnico do ativo**: evento `service_order_sla_breached`
  quando `sla_breached_at` existe - ver [PRONTUARIO-TECNICO-ATIVO.md](PRONTUARIO-TECNICO-ATIVO.md).
- **Card e filtros do board de OS**: badge de vencida/proxima do vencimento
  no card, filtro dedicado "Prazo (SLA)".

## Limitacoes desta rodada

- Sem pausa de SLA (ex.: aguardando peca/cliente) - o prazo corre continuo
  desde a criacao ate a finalizacao ou reabertura.
- OS criadas antes desta rodada nao tem `sla_due_at` retroativo - aparecem
  como `not_applicable` ate passarem por um dos dois unicos pontos que
  recalculam o prazo: escalonamento de prioridade automatica ou reabertura.
- Mudar a prioridade manualmente (`PATCH /:id/priority`) nao recalcula
  `sla_due_at` - o prazo so muda via escalonamento automatico ou reabertura,
  para nao mudar um prazo ja combinado so por causa de uma correcao manual.
- O checklist tecnico obrigatorio (`requireChecklistBeforeFinish`) e uma
  politica global, nao por tipo de problema ou prioridade.
