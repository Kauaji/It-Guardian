# Fase 3 - Plano de Migracao para Backend

## Objetivo

Separar responsabilidades de forma clara:

- **Frontend mostra**: layout, tema, filtros de tela, modais, drag-and-drop visual, empty states e preferencia visual.
- **Backend decide**: regras, permissoes, validacoes, numeracao, historico, status, prioridade, modo Local/Business e persistencia.

## Classificacao da auditoria

### A. Deve ficar no frontend

- Tema claro/noturno apos login.
- Presets de aparencia por usuario.
- Tamanho de fonte.
- Estado de accordions/modais.
- Filtros visuais de tela.
- Overlay e comportamento visual do drag-and-drop.
- Aba ativa do inventario.

### B. Deve ir para backend agora

- Modo Local/Business. **Migrado para `/api/system-settings`.**
- Numeracao da OS.
- Status inicial/final da OS.
- Historico da OS.
- Usuarios, setores e permissoes.
- Configuracoes da OS.
- Servicos, tecnicos, clientes, produtos/pecas, tipos de problema e regras de prioridade.
- Manutencao ligada a OS.
- Backup ligado a OS.

### C. Pode ir para backend depois

- Preferencias visuais por usuario.
- Preferencia de visualizacao horizontal/vertical por usuario, se deixar de ser global.
- Estado expandido/recolhido de paineis.
- Ultima busca/filtro usado.

### D. Deve continuar mockado ate integracao real

- OCS Inventory.
- Zabbix.
- Ping real.
- Coletor por cliente.
- Metricas historicas reais.

### E. Deve ser removido ou substituido

- Dependencia de `localStorage` para manutencao.
- Dependencia de `localStorage` para abas/ambientes do inventario.
- Seeds demo automaticos em producao real. **Resolvido para ambientes production-like; falta apenas fluxo formal de primeiro admin real.**
- Regras criticas duplicadas no frontend sem validacao equivalente no backend.

## Prioridades

### Prioridade 1 - Critico

1. Usuarios, administradores, setores e permissoes.
2. Modo Local/Business.
3. Ordens de Servico.
4. Status inicial/final da OS.
5. Historico da OS.
6. Numeracao da OS.

Status atual: backend ja cobre esses pontos, com ressalva para reforco transacional na numeracao.

### Prioridade 2 - Importante

1. Clientes.
2. Tecnicos.
3. Produtos/pecas.
4. Servicos.
5. Regras de prioridade.
6. Configuracoes da OS.
7. Vinculo OS com maquina.
8. Manutencao/backup vinculados a OS.

Status atual: cadastros e OS ja usam backend; manutencao/backup ainda exigem consolidacao.

### Prioridade 3 - Futuro

1. Historico tecnico completo da maquina.
2. OCS real.
3. Zabbix real.
4. Ping real.
5. Dashboard com dados reais.
6. Coletor por cliente.

## Proposta de tabelas

### Administracao

- `users`
- `sectors`
- `user_permissions` ou `users.permissions` em JSONB
- `sector_permissions` ou `sectors.permissions` em JSONB

O projeto atualmente usa `permissions` JSONB em usuarios e setores, o que e aceitavel para o MVP.

### Configuracoes

- `app_settings`
- `system_settings` futuramente, se quiser separar do JSON generico
- `service_order_settings` futuramente, se quiser separar do JSON generico

O projeto atualmente usa `app_settings` com chaves como `system` e `service_orders`.

### Ordens de Servico

- `service_orders`
- `service_order_statuses` ou `app_settings.service_orders.statuses`
- `service_order_history`
- `service_order_items`
- `service_catalog`
- `clients`
- `technicians`
- `products`
- `problem_types`
- `priority_rules`

Para a Fase 3, `app_settings.service_orders.statuses` e suficiente. Em producao maior, `service_order_statuses` dedicado melhora auditoria e concorrencia.

### Inventario

- `inventory_tabs` **a criar**
- `inventory_segments`
- `segment_groups`
- `device_segments`
- `device_metadata`
- `asset_history`
- `manual_network_assets`
- `backup_assignments` ou campos em `device_metadata`
- `maintenance_records` **a criar ou consolidar em OS + asset_history**

## Proposta de endpoints

### Sistema

- `GET /api/system-settings`
- `PATCH /api/system-settings`

### Usuarios e permissoes

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

O projeto ja possui usuarios e setores. Permissoes hoje sao atualizadas pelo payload de usuario/setor.

### Ordens de Servico

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

O projeto mantem `PATCH /api/service-orders/:id` para compatibilidade e tambem possui aliases explicitos para prioridade, tecnico, ativo e itens.

### Configuracoes da OS

- `GET /api/service-orders/settings`
- `PATCH /api/service-orders/settings`
- `GET /api/service-order-settings`
- `PATCH /api/service-order-settings`
- `GET /api/service-order-statuses`
- `POST /api/service-order-statuses`
- `PATCH /api/service-order-statuses/:id`
- `DELETE /api/service-order-statuses/:id`
- `GET /api/services`
- `POST /api/services`
- `PATCH /api/services/:id`
- `DELETE /api/services/:id`
- `GET /api/clients`
- `GET /api/products`
- `GET /api/technicians`
- `GET /api/problem-types`
- `GET /api/priority-rules`

### Inventario

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
- `GET /api/inventory-tabs` **a criar**
- `POST /api/inventory-tabs` **a criar**
- `PATCH /api/inventory-tabs/:id` **a criar**
- `DELETE /api/inventory-tabs/:id` **a criar**

## Riscos

- Migrar abas do inventario pode afetar a Fase 1; deve ser feito com feature flag ou fallback.
- Numeracao da OS precisa transacao para concorrencia real.
- Seeds demo estao bloqueados em production-like; ainda falta definir provisionamento seguro do primeiro admin real.
- Regras duplicadas no frontend devem ser removidas gradualmente para evitar divergencia.
- Integracoes reais exigem rede interna, credenciais e limites de seguranca.

## Checklist de execucao

1. Build verde antes de iniciar.
2. Criar branch propria para cada migracao grande.
3. Migrar uma regra por vez.
4. Manter fallback apenas enquanto a API nova estabiliza.
5. Testar usuario admin, tecnico e usuario sem permissao.
6. Testar modo Local e Business.
7. Testar OS criada, editada, finalizada e excluida.
8. Testar Inventario depois de cada mudanca.
9. Atualizar documentacao.
10. Remover fallback local quando a API estiver validada.
