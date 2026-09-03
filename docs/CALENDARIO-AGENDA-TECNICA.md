# Agenda Técnica

## Objetivo

A Agenda Técnica centraliza compromissos operacionais do IT Guardian sem substituir o fluxo de Ordens de Serviço. Ela organiza OS agendadas, manutenções preventivas, visitas, tarefas internas, verificações de ativos, lembretes e outros eventos.

## Visualizações e fluxo

- **Mês:** visão ampla com até três eventos por dia e indicador dos demais.
- **Semana:** sete colunas com a agenda do período.
- **Dia:** foco em todos os compromissos de uma data.
- Um clique em uma data abre `Novo agendamento` com a data preenchida.
- Um clique em um evento abre os detalhes para editar, concluir, cancelar ou excluir conforme a permissão do usuário.

O formulário aceita título, período, dia inteiro, tipo, status, prioridade, técnico, OS, ativo, segmento, grupo, ambiente e descrição. A data final, quando preenchida, deve ser posterior à inicial.

## Integrações internas

Na ficha de uma OS, a aba **Agenda** lista seus compromissos e oferece `Agendar atendimento` e `Abrir no calendário`. Ao agendar pela OS, o título, o identificador da OS e o ativo relacionado são sugeridos automaticamente.

Os filtros por técnico, tipo, status e busca textual são combináveis. O backend exige `startDate` e `endDate` e limita cada consulta a 93 dias para não carregar a agenda completa.

## Permissões

- `calendar.view`
- `calendar.create`
- `calendar.update`
- `calendar.cancel`
- `calendar.delete`
- `calendar.assign_technician`
- `calendar.view_all_technicians`

Administradores recebem todas as permissões. Sem `view_all_technicians`, o usuário vê apenas eventos criados por ele ou atribuídos ao técnico correspondente ao seu nome/e-mail.

## API

- `GET /api/calendar/events`
- `POST /api/calendar/events`
- `GET /api/calendar/events/:id`
- `PATCH /api/calendar/events/:id`
- `POST /api/calendar/events/:id/cancel`
- `DELETE /api/calendar/events/:id`
- `GET /api/calendar/summary`

## Limitações da V1

Não há sincronização com Google/Outlook, recorrência avançada, escala trabalhista, WhatsApp, e-mail ou bloqueio automático de conflito. Eventos cancelados são preservados com status, data e motivo; a exclusão física é uma ação separada e mais restrita.
