# Fase 3 - Plano de Migracao para Backend

Plano tecnico baseado na auditoria da Fase 3. Este documento nao implementa
migracao e nao altera funcionalidades. Ele organiza a ordem segura para mover
regras importantes do IT Guardian para o backend.

## Principio central

**Frontend mostra, backend decide.**

- O frontend deve cuidar de layout, experiencia, filtros de tela, modais,
  tema, drag-and-drop visual, estados temporarios e preferencias visuais.
- O backend deve cuidar de regras de negocio, permissoes, validacoes,
  historico, numeracao, status, prioridade, modo Local/Business, vinculos
  entre entidades e persistencia.

## O que fica no frontend

Pode continuar no frontend:

- Tema claro/noturno depois do login.
- Presets de aparencia, cor de destaque e tamanho de fonte.
- Estado visual de modais, accordions, popovers e filtros.
- Aba ativa/ultima visualizacao como preferencia local.
- Drag-and-drop visual, overlay compacto e selecao multipla.
- Busca e filtros de tela, desde que a API continue aplicando permissoes.
- Previa visual do numero da OS.
- Labels, badges, tooltips e mensagens de apoio.
- Fallbacks visuais para API indisponivel, sem assumir regra final.

Nao devem ficar como fonte de verdade no frontend:

- Permissoes reais.
- Status inicial/final de OS.
- Numeracao final de OS.
- Historico de OS.
- Historico tecnico de maquina.
- Manutencao e retorno de manutencao.
- Backup em uso por OS.
- Regras de prioridade.
- Modo Local/Business.
- Relacao real entre OS, maquina, cliente, setor, tecnico e servico.

## O que vai para backend

Ja esta majoritariamente no backend:

- Ordens de Servico.
- Usuarios.
- Setores.
- Permissoes.
- Modo Local/Business.
- Configuracoes da OS.
- Status da OS.
- Historico da OS.
- Itens/pecas da OS.
- Clientes, tecnicos, produtos/pecas, servicos, tipos de problema e regras de prioridade.
- Protecao administrativa: cadastro publico apenas para o primeiro admin, rotas administrativas com `requireAdmin`, ultimo admin ativo protegido, usuario inativo bloqueado e permissao efetiva calculada no backend.
- Configuracoes de regra: modo Local/Business, formato da OS, prioridade automatica, cores, layout do painel, status da OS e catalogo de servicos.
- Integridade de status: maximo de 10, exatamente um inicial/final e bloqueio de remocao quando houver OS vinculada.
- Integridade de servicos: codigo automatico, codigo unico, valor padrao e prioridade padrao.

Ainda precisa migrar/consolidar:

- Advisory lock/transacao distribuida para numeracao da OS, apenas se o deploy usar multiplas instancias simultaneas.
- Manutencao automatica vinculada a OS.
- Devolucao da maquina ao local de origem.
- Backup vinculado a OS como fluxo transacional.
- Regras de exclusao/cancelamento de OS com maquina ou backup ativo.
- Abas/ambientes do inventario.
- Pertencimento de grupos, segmentos e maquinas a abas/ambientes.
- Observacoes de maquina.
- Historico de perifericos.
- Perifericos removidos.
- Validacao do formulario publico em modo Business.
- Permissoes duplicadas entre frontend e backend.
- Unificacao futura dos IDs de permissoes entre frontend/backend ainda e recomendada; hoje existem aliases legados para manter compatibilidade.

## Ordem de migracao por prioridade

### Prioridade 1 - Critico

Objetivo: garantir que OS, acesso, permissao e configuracao base sejam
controlados pelo backend antes de qualquer integracao real.

1. **Ordens de Servico**
   - Backend deve ser fonte de criacao, edicao, exclusao/desativacao e consulta.
   - Frontend apenas consome API e envia intencoes de acao.

2. **Numeracao da OS**
   - Reforcar geracao no backend com transacao/lock.
   - Garantir unicidade mesmo com duas OS criadas ao mesmo tempo.
   - Nao alterar numeros antigos.

3. **Status inicial/final**
   - Backend decide status inicial na criacao.
   - Backend decide quando uma OS foi finalizada.
   - `closed_at` deve ser persistido quando entrar no status final.

4. **Historico da OS**
   - Toda acao relevante deve gerar evento persistido.
   - Frontend nao deve criar historico oficial sozinho.

5. **Prioridade automatica**
   - Backend calcula prioridade final.
   - Frontend pode mostrar preview, mas nao decidir regra final.

6. **Usuarios**
   - Backend controla ativo/inativo, senha hash, setor, papel e admin.
   - Usuario inativo nao acessa.

7. **Permissoes**
   - Middleware deve proteger todas as rotas sensiveis.
   - Frontend esconde menus apenas como UX.

8. **Setores**
   - Backend controla cadastro, status e permissoes padrao.
   - OS deve respeitar setor do usuario quando aplicavel.

9. **Modo Local/Business**
   - Backend continua fonte por `/api/system-settings`.
   - Frontend adapta tela, mas nao decide regra final.

Status atual: grande parte ja foi migrada. Pendencias principais da prioridade 1
sao revisao completa de permissoes duplicadas e
garantia de que todo historico oficial nasce no backend.

### Prioridade 2 - Importante

Objetivo: consolidar cadastros e configuracoes operacionais da OS e fechar
vinculos com inventario.

1. **Servicos**
   - Persistir codigo, nome, categoria, prioridade padrao e valor.
   - Backend deve evitar codigo duplicado.

2. **Clientes**
   - Persistir dados cadastrais.
   - No modo Business, backend deve validar cliente quando necessario.
   - Tecnicos com clientes permitidos devem ter filtro no backend.

3. **Tecnicos**
   - Persistir cadastro e clientes permitidos.
   - Backend deve validar atribuicao quando regra exigir.

4. **Produtos/pecas**
   - Persistir produtos e valores.
   - Backend deve registrar uso na OS e calcular subtotal.
   - Estoque avancado fica fora desta etapa.

5. **Configuracoes da OS**
   - Persistir formato do numero, status, cores, prioridade automatica,
     layout do painel, tipos de problema e regras de prioridade.
   - Frontend apenas edita via API.

6. **Regras de prioridade**
   - Backend aplica regras por setor, cliente, servico, categoria, tipo de
     problema e tempo.
   - Frontend pode exibir explicacao/preview.

7. **Vinculo OS com maquina**
   - Backend deve registrar vinculo, historico e efeito operacional.
   - Integracao OS -> manutencao deve deixar de depender do React.

8. **Manutencao/backup basicos da OS**
   - Ao vincular maquina, backend coloca em manutencao quando a regra pedir.
   - Ao finalizar OS, backend devolve maquina ou usa fallback seguro.
   - Backup usado por OS deve ser bloqueado para outras OS ativas.

### Prioridade 3 - Futuro

Objetivo: preparar implementacao real de monitoramento e inventario dinamico.

1. **Manutencao avancada**
   - Fluxos de cancelamento, reabertura, retirada manual, SLA e auditoria
     completa.

2. **Historico completo da maquina**
   - Consolidar observacoes, perifericos, manutencao, backup, QR Code e
     alteracoes de segmento em `asset_history`.

3. **Dashboard real**
   - Substituir metricas mockadas por fontes reais.
   - Criar agregacoes e indicadores por setor/cliente.

4. **OCS real**
   - Integrar OCS Inventory por adaptador.
   - Manter fallback mock para desenvolvimento.

5. **Zabbix real**
   - Integrar hosts, alertas e historico por adaptador.
   - Tratar credenciais, timeout e erros.

6. **Ping real**
   - Executar via VPS, agente ou coletor na rede do cliente.
   - Nao depender de ambiente serverless para ping de rede interna.

7. **Coletor por cliente**
   - Separar coleta por ambiente/cliente.
   - Preparar autenticao, fila, retry e telemetria.

## Tabelas sugeridas

### Administracao e permissoes

Ja existem:

- `users`
- `sectors`
- `audit_logs`

Manter ou evoluir:

- `users.permissions` JSONB no MVP.
- `sectors.permissions` JSONB no MVP.
- Futuro opcional: `user_permissions` e `sector_permissions`, se o volume ou
  auditoria exigir granularidade relacional.

### Configuracoes

Ja existe:

- `app_settings`
- `service_order_settings`
- `service_order_statuses`

Manter no MVP:

- `app_settings` com chave `system` e compatibilidade legada.
- `service_order_settings` para formato da OS, proximo numero, prioridade automatica, cores e layout do painel.
- `service_order_statuses` para status inicial/final, ordem e cores dos segmentos da OS.

Futuro opcional:

- `system_settings`
- `appearance_preferences`
- `user_preferences`

### Ordens de Servico

Ja existem:

- `service_orders`
- `service_order_settings`
- `service_order_statuses`
- `service_order_history`
- `service_order_items`
- `service_catalog`
- `clients`
- `technicians`
- `products`
- `problem_types`
- `priority_rules`

Evoluir quando necessario:

- `service_order_transitions`, se houver fluxo formal de transicoes.
- `service_order_asset_links`, se uma OS puder ter mais de uma maquina.

### Inventario

Ja existem:

- `inventory_segments`
- `segment_groups`
- `device_segments`
- `manual_network_assets`
- `device_metadata`
- `asset_history`

Criar/consolidar:

- `inventory_tabs`
- `inventory_tab_memberships`
- `maintenance_records`
- `backup_assignments`
- `asset_observations`, se observacoes nao forem apenas eventos em `asset_history`.
- `asset_peripheral_history`, se perifericos precisarem de estrutura propria.

### Integracoes futuras

Sugeridas para fases posteriores:

- `integration_connections`
- `collector_agents`
- `collector_heartbeats`
- `ocs_devices_raw`
- `zabbix_hosts_raw`
- `zabbix_alerts`
- `ping_checks`

## Endpoints sugeridos

### Sistema

- `GET /api/system-settings`
  - Le configuracoes globais de regra; exige usuario autenticado.
- `PATCH /api/system-settings`
  - Atualiza modo Local/Business; exige `settings.system_mode`.
- Futuro: `GET /api/user-preferences`
- Futuro: `PATCH /api/user-preferences`

### Usuarios, setores e permissoes

Ja existentes/esperados:

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`
- `GET /api/sectors`
- `POST /api/sectors`
- `PATCH /api/sectors/:id`
- `DELETE /api/sectors/:id`
- `GET /api/permissions`
- `PATCH /api/users/:id/permissions`
- `PATCH /api/sectors/:id/permissions`

### Ordens de Servico

Ja existentes/esperados:

- `GET /api/service-orders`
- `GET /api/service-orders/:id`
- `POST /api/service-orders`
- `PATCH /api/service-orders/:id`
- `PATCH /api/service-orders/:id/status`
- `PATCH /api/service-orders/:id/priority`
- `PATCH /api/service-orders/:id/technician`
- `PATCH /api/service-orders/:id/asset`
- `POST /api/service-orders/:id/items`
- `POST /api/service-orders/:id/history`
- `DELETE /api/service-orders/:id`

Adicionar/consolidar:

- `POST /api/service-orders/:id/asset-maintenance`
- `DELETE /api/service-orders/:id/asset-maintenance`
- `POST /api/service-orders/:id/backup`
- `DELETE /api/service-orders/:id/backup`
- `POST /api/service-orders/:id/cancel`
- `POST /api/service-orders/:id/reopen`

### Configuracoes da OS e cadastros

Ja existentes/esperados:

- `GET /api/service-order-settings`
  - Le formato de numero, prioridade automatica, cores e layout; exige `service_orders.view`.
- `PATCH /api/service-order-settings`
  - Atualiza formato de numero, prioridade automatica, cores, layout e status; exige `service_orders.settings`.
  - Bloqueia remocao de status usado por OS.
- `GET /api/service-order-statuses`
  - Lista status configurados; exige `service_orders.view`.
- `POST /api/service-order-statuses`
- `PATCH /api/service-order-statuses/:id`
- `DELETE /api/service-order-statuses/:id`
  - Mutacoes exigem `service_orders.settings`; remocao de status em uso deve retornar erro.
- `GET /api/services`
- `POST /api/services`
- `PATCH /api/services/:id`
- `DELETE /api/services/:id`
  - Mantem catalogo de servicos com codigo, valor e prioridade padrao; criacao sem codigo gera `SRV-0001`, `SRV-0002` etc.
  - Codigo duplicado deve retornar conflito.
- `GET /api/clients`
- `POST /api/clients`
- `PATCH /api/clients/:id`
- `DELETE /api/clients/:id`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/technicians`
- `POST /api/technicians`
- `PATCH /api/technicians/:id`
- `DELETE /api/technicians/:id`
- `GET /api/problem-types`
- `GET /api/priority-rules`

### Inventario

Ja existentes/esperados:

- `GET /api/devices`
- `GET /api/devices/:id`
- `PATCH /api/devices/:id/segment`
- `PATCH /api/devices/:id/backup`
- `POST /api/devices/manual`
- `PATCH /api/devices/:id/manual`
- `GET /api/segments`
- `POST /api/segments`
- `PATCH /api/segments/:id`
- `DELETE /api/segments/:id`

Adicionar:

- `GET /api/inventory-tabs`
- `POST /api/inventory-tabs`
- `PATCH /api/inventory-tabs/:id`
- `DELETE /api/inventory-tabs/:id`
- `PATCH /api/inventory-tabs/:id/memberships`
- `GET /api/assets/:id/history`
- `POST /api/assets/:id/observations`
- `POST /api/assets/:id/peripherals/:peripheralId/remove`
- `POST /api/assets/:id/maintenance`
- `DELETE /api/assets/:id/maintenance`

### Integracoes futuras

- `GET /api/integrations/status`
- `POST /api/integrations/ocs/sync`
- `POST /api/integrations/zabbix/sync`
- `POST /api/devices/:id/ping`
- `POST /api/collectors/heartbeat`
- `POST /api/collectors/inventory`
- `POST /api/collectors/metrics`

## Riscos

- Migrar inventario pode quebrar a Fase 1 se abas/segmentos forem movidos de uma vez.
- Numeracao de OS ja possui indice unico e retry; deploy multi-instancia ainda pode exigir advisory lock para reduzir colisoes e saltos de sequencia.
- Remover fallback local cedo demais pode deixar o sistema inutilizavel durante instabilidade da API.
- Duplicacao de permissoes entre frontend e backend pode esconder botao errado ou mostrar botao bloqueado.
- Permissoes `admin.*` devem continuar restritas a `role=admin`/`is_admin=true`; nao confiar em permissao administrativa individual em usuario comum.
- Formulario publico precisa validar regras no backend para evitar OS incompleta por chamada direta.
- OCS/Zabbix/ping reais exigem credenciais, rede interna, timeout e tratamento de indisponibilidade.
- Seeds demo devem continuar bloqueados em producao real.
- Manutencao/backup precisam ser transacionais para nao deixar maquinas presas em segmentos errados.

## Checklist de execucao

Antes de qualquer migracao:

- [ ] Criar branch especifica para a migracao.
- [ ] Rodar build antes de alterar.
- [ ] Registrar comportamento atual no checklist.
- [ ] Definir rollback simples.
- [ ] Garantir que dados demo nao sejam usados como producao.

Durante a migracao:

- [ ] Migrar uma regra por vez.
- [ ] Criar/ajustar tabela ou coluna.
- [ ] Criar repository/service no backend.
- [ ] Proteger endpoints com permissao.
- [ ] Adicionar validacao no backend.
- [ ] Manter fallback temporario quando necessario.
- [ ] Atualizar frontend para consumir API.
- [ ] Remover decisao final do frontend.
- [ ] Registrar historico/auditoria quando aplicavel.

Depois da migracao:

- [ ] Testar admin, tecnico e usuario sem permissao.
- [ ] Testar modo Local.
- [ ] Testar modo Business.
- [ ] Testar OS criada, editada, finalizada e excluida.
- [ ] Testar inventario apos qualquer mudanca relacionada a maquina.
- [ ] Testar build.
- [ ] Atualizar documentacao.
- [ ] Remover fallback local apenas apos validar fluxo completo.

## Sequencia recomendada

1. Monitorar numeracao da OS em deploy multi-instancia e evoluir para advisory lock se necessario.
2. Consolidar validacao do formulario publico no backend.
3. Migrar manutencao e retorno de manutencao para backend.
4. Migrar fluxo de Backup usado por OS para backend.
5. Migrar abas/ambientes do inventario.
6. Migrar observacoes e historico de perifericos.
7. Unificar fonte de permissoes do frontend com backend.
8. Preparar integracoes reais de OCS, Zabbix, ping e coletor.

## Conclusao

O backend ja cobre o nucleo de OS, usuarios, setores, permissoes, modo do
sistema e configuracoes da OS. A proxima etapa de migracao deve ser cuidadosa
porque o principal risco restante esta na fronteira entre OS e Inventario:
manutencao, Backup, historico tecnico e ambientes/abas.

## Estado apos auditoria final - 30/05/2026

Confirmado por build e smoke test de API:

- Ordens de Servico usam backend para numero, status inicial/final, servico,
  valor, itens, historico e `closed_at`.
- Usuarios, setores e permissoes sao protegidos no backend, com `401`/`403`
  para acessos indevidos.
- Modo Local/Business e Configuracoes da OS sao persistidos no backend.
- Status em uso nao pode ser excluido sem mover as OS vinculadas.
- Servicos possuem codigo unico e podem carregar valor/prioridade padrao.
- Preferencias visuais continuam no frontend por serem estado de experiencia,
  nao regra de negocio.

Proxima prioridade: migrar manutencao/Backup e abas/ambientes do Inventario
para backend antes de iniciar OCS, Zabbix, ping real ou coletor.
