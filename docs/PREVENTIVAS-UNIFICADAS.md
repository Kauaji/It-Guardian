# Preventivas Unificadas

## Objetivo

Esta fase consolida o conceito de Preventivas no IT Guardian. A tela principal passa a tratar planos preventivos manuais e planos automatizados como partes do mesmo fluxo operacional, evitando a separação artificial entre "Preventivas" e "Automação Preventiva".

## Conceitos

Plano preventivo:
- Registro operacional de uma rotina preventiva.
- Pode envolver uma ou várias máquinas.
- Pode ter verificações/scripts associados.
- Registra histórico/log de preparação.
- Não cria Ordem de Serviço automaticamente.

Plano automatizado:
- Configuração recorrente vinculada ao fluxo preventivo.
- Agenda e prepara rotinas futuras.
- Nesta versão não executa comandos reais.
- A execução real continua dependente de agente seguro.

OS preventiva:
- Ordem de Serviço real.
- Pode ser criada manualmente a partir de um plano preventivo.
- Entra no painel normal de Ordens de Serviço.
- Segue permissões, status e regras comuns da OS.

## Implementação atual

No frontend, a navegação foi unificada:
- A aba separada "Automação" foi removida.
- A aba "Preventivas" agora abriga o fluxo de registro manual e a seção "Planos automatizados".
- O resumo preventivo passou a exibir "Planos automatizados" junto dos demais indicadores.
- Rotas/estados antigos que apontem para `automation` são redirecionados para `preventives`.

No backend, as estruturas existentes foram preservadas:
- `preventive_plans`
- `preventive_plan_assets`
- `preventive_plan_scripts`
- `preventive_automation_plans`
- `preventive_automation_overrides`
- `preventive_automation_asset_schedules`
- `preventive_automation_runs`

Nenhuma migração destrutiva foi aplicada nesta fase.

## Modelo de dados recomendado

Para a próxima etapa backend, a relação ideal é:

```text
preventive_plans
  1 ─── 0..1 preventive_automation_plans
```

Campos sugeridos para `preventive_automation_plans`:
- `preventive_plan_id`
- `indicator_color`
- `active`
- `recurrence_type`
- `recurrence_interval_days`
- `preferred_time`
- `timezone`
- `created_by`
- `created_at`
- `updated_at`

Regras:
- Um plano preventivo pode existir sem automação.
- Um plano preventivo automatizado não deve duplicar outro agendamento igual.
- Máquinas podem participar de múltiplos planos preventivos.
- Indicadores visuais devem vir do backend para evitar divergência entre tela e banco.

## Indicadores visuais

A UI deve evoluir para mostrar pequenos indicadores coloridos nos cards de máquinas:
- Cada ponto representa um plano preventivo que inclui a máquina.
- A cor deve vir do plano automatizado ou da configuração visual do plano.
- O tooltip deve mostrar o nome do plano, recorrência e próxima previsão.
- Máquinas com múltiplos planos devem exibir múltiplos pontos.

## Segurança

Nenhum comando BAT, CMD, PowerShell ou Shell é executado pelo navegador ou pelo servidor nesta fase.

O sistema apenas:
- registra planos;
- agenda/prepara rotinas;
- salva logs;
- exibe status;
- mantém rastreabilidade.

Execução real só deve existir futuramente com agente seguro instalado na máquina.

## Pendências técnicas

- Criar migração idempotente para vincular `preventive_automation_plans.preventive_plan_id`.
- Ajustar endpoints para criar/editar automação junto do plano preventivo.
- Expor indicadores por máquina no endpoint de inventário/preventivas.
- Bloquear duplicidade de automação para o mesmo plano preventivo.
- Atualizar logs e histórico para exibir vínculo entre plano, automação e OS preventiva.
- Adicionar testes backend cobrindo criação de plano sem OS automática e criação opcional de OS preventiva.

## Validação esperada

- Criar plano preventivo não cria OS automaticamente.
- O plano aparece na aba Preventivas.
- Planos automatizados aparecem dentro da mesma aba.
- A aba separada Automação não aparece mais.
- O build do frontend passa.
- Backend e permissões existentes continuam funcionando.
