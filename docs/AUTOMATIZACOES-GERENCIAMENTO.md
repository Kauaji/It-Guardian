# Gerenciamento de automatizações

## Objetivo

A área **Automatizações**, dentro da Central de Avisos, centraliza a consulta e o gerenciamento dos planos de automação preventiva já cadastrados. Ela não executa comandos e não substitui o fluxo de criação disponível em **Preventivas**.

## Visibilidade da aba

A aba é exibida somente quando:

- o usuário possui `preventive_automation.view`;
- existe ao menos um plano não excluído logicamente.

Quando o último plano é excluído, a interface retorna para **Preventivas** e remove a aba. A criação ou exclusão atualiza os dados sem exigir novo login.

## Listagem

O endpoint `GET /api/preventive-automation-plans/management` retorna planos, máquinas e metadados de contagem em lote. A lista:

- contém somente máquinas ainda vinculadas a planos não excluídos;
- reúne uma máquina com vários planos em uma única linha;
- permite busca por máquina, plano, ambiente, grupo ou segmento;
- oferece filtros para ativos, inativos, com erro e sem próxima agenda;
- agrupa por ambiente, grupo e segmento;
- não faz uma consulta por card.

## Indicadores

O componente compartilhado `AutomationIndicatorDots` representa cada plano por uma bolinha com a cor de `indicator_color`.

- cada plano gera um indicador independente;
- o botão `+N` reúne indicadores excedentes;
- tooltip e `aria-label` informam nome, recorrência, próxima preparação e status;
- o clique abre os dados gerais do plano;
- `Escape` fecha o popover e devolve o foco ao acionador.

A cor é um apoio visual, nunca o único identificador.

## Detalhes e edição do plano

Os detalhes gerais apresentam status, recorrência, horário, fuso, máquinas, scripts, preparações, plano preventivo relacionado, criador, observações e cor.

Com `preventive_automation.update`, o usuário pode editar:

- nome, descrição e observações;
- recorrência e intervalo personalizado;
- horário e fuso;
- cor;
- scripts vinculados;
- estado ativo ou inativo.

A atualização reaproveita `PATCH /api/preventive-automation-plans/:id` e sincroniza as agendas do plano.

## Exclusão lógica

Com `preventive_automation.delete`, o usuário pode excluir um plano após digitar seu nome para confirmação.

O backend:

- preenche `deleted_at`;
- desativa as agendas futuras;
- preserva runs, logs, histórico e plano preventivo relacionado;
- registra `preventive_automation_deleted` na auditoria;
- remove os indicadores das consultas ativas.

Não há exclusão física do plano.

## Gerenciamento por máquina

O menu da máquina exige a seleção explícita do plano quando houver mais de um. O detalhe usa:

- `GET /api/preventive-automation-plans/:planId/assets/:assetId`;
- agenda efetiva e sua origem (`plan`, `segment` ou `machine`);
- última preparação e último resultado;
- scripts;
- override;
- histórico recente do ativo.

### Recorrência personalizada

Com `preventive_automation.manage_asset_override`:

- `PUT /api/preventive-automation-plans/:planId/assets/:assetId/override` cria ou atualiza o override;
- `DELETE /api/preventive-automation-plans/:planId/assets/:assetId/override` restaura o padrão.

A chave única continua sendo `plan_id + target_key`, evitando duplicidade. As agendas são recalculadas sem alterar outras máquinas.

### Remoção da máquina

Com `preventive_automation.remove_asset`, o endpoint
`DELETE /api/preventive-automation-plans/:planId/assets/:assetId`:

- remove o ativo de `asset_ids` ou o adiciona a `excluded_asset_ids`;
- desativa somente sua agenda;
- remove seu override;
- preserva runs e histórico;
- registra `preventive_automation_removed_from_asset`;
- desativa o plano se não restar nenhuma máquina.

## Permissões

- `preventive_automation.view`
- `preventive_automation.create`
- `preventive_automation.update`
- `preventive_automation.disable`
- `preventive_automation.run_prepare`
- `preventive_automation.delete`
- `preventive_automation.remove_asset`
- `preventive_automation.manage_asset_override`

As rotas validam permissões no backend. Ocultar ações no frontend é apenas uma camada adicional de experiência.

## Índices e persistência

Foram mantidos ou adicionados índices idempotentes para planos ativos/excluídos, agendas por plano/ativo e overrides por plano/chave. `excluded_asset_ids` preserva a remoção individual em escopos amplos sem apagar o histórico.

## Segurança e limitações

Esta área cadastra, agenda, edita e audita. Ela não executa BAT, CMD, PowerShell ou qualquer outro comando.

Não foram adicionadas APIs como `child_process`, `exec`, `execFile`, `spawn`, `eval` ou `shell: true`. Preparações reais continuam dependentes de um agente seguro externo.

O projeto ainda não possui script de lint nem suíte de navegador dedicada. Os contratos de interface são validados pela suíte Node e o fluxo visual deve ser conferido nos viewports definidos na especificação.
