# Fase 3 - Auditoria Tecnica

Este documento mapeia o estado tecnico do IT Guardian antes da implementacao real com PostgreSQL definitivo, coletor, OCS, Zabbix e ping real.

## Resumo

A Fase 2 ja deixou uma parte importante das regras no backend:

- Ordens de Servico sao criadas pela API.
- O numero da OS e gerado no backend.
- Status inicial/final e prioridade automatica ficam em `app_settings`.
- Usuarios, setores e permissoes ficam em tabelas e sao validados por middleware.
- Cadastros de clientes, tecnicos, pecas, servicos, tipos de problema e regras de prioridade ja usam tabelas.
- O inventario ainda mistura dados persistidos, dados mockados e alguns estados locais de interface.

A maior fragilidade restante para uma implementacao real esta no Inventario: abas, metadados locais, manutencao local, observacoes, apelidos e historico de perifericos ainda dependem do navegador.

## Atualizacao apos migracao inicial

Auditoria final executada em 29/05/2026:

- Ordens de Servico, historico, itens, status, configuracoes e numeracao usam backend como fonte principal.
- Usuarios, setores e permissoes usam backend e middleware de autorizacao.
- Modo Local/Business usa `/api/system-settings`.
- Configuracoes de regra da OS usam `/api/service-order-settings` e endpoints relacionados.
- `localStorage` ficou restrito principalmente a sessao, tema/preferencias visuais e estados ainda locais do Inventario.
- `DATABASE_URL=memory` e bloqueado em producao.
- `JWT_SECRET` inseguro e bloqueado em producao.
- Seeds demo nao rodam em ambiente production-like.
- OS criada pela auditoria: `OS-0005`, finalizada com `closed_at`, 7 eventos de historico e 1 item.
- Smoke test do Inventario retornou 47 dispositivos, 6 segmentos e 3 grupos.

## localStorage

| Chave | Arquivo | Dado salvo | Classe | Acao recomendada | Prioridade |
| --- | --- | --- | --- | --- | --- |
| `it_guardian_token` | `client/src/App.jsx` | JWT da sessao | Sessao local | Pode continuar no frontend, mas com expiracao curta e refresh futuro | Media |
| `it_guardian_user` | `client/src/App.jsx` | Snapshot do usuario logado | Cache local | Manter como cache; backend continua fonte da verdade | Media |
| `it_guardian_theme` | `client/src/App.jsx`, `GeneralSettingsModal.jsx` | Tema claro/escuro | Preferencia visual | Pode continuar no frontend | Baixa |
| `it_guardian_general_preferences` | `GeneralSettingsModal.jsx` | Fonte, microinteracoes, preferencias visuais | Preferencia visual | Pode continuar no frontend ou virar preferencia por usuario | Baixa |
| `it_guardian_accent_color` | `GeneralSettingsModal.jsx` | Cor principal customizada | Preferencia visual | Pode continuar no frontend | Baixa |
| `it_guardian_asset_aliases` | `App.jsx` | Nome fantasia/apelido de maquina | Dado de inventario | Migrar para `device_metadata` | Alta |
| `it_guardian_asset_observations` | `App.jsx` | Observacoes de maquina | Historico/dado tecnico | Migrar para `device_metadata` ou `asset_history` | Alta |
| `it_guardian_removed_peripherals` | `App.jsx` | Perifericos removidos | Historico tecnico | Migrar para `asset_history` | Alta |
| `it_guardian_peripheral_history` | `App.jsx` | Historico local de perifericos | Historico tecnico | Migrar para `asset_history` | Alta |
| `it_guardian_maintenance_records` | `App.jsx` | Estado de manutencao/origem | Regra de negocio | Migrar integralmente para backend | Critica |
| `it_guardian_inventory_tabs` | `App.jsx` | Abas/ambientes do inventario | Regra/estrutura de inventario | Criar tabela `inventory_tabs` | Alta |
| `it_guardian_inventory_tab_meta` | `App.jsx` | Vinculo de grupos/segmentos/maquinas por aba | Regra/estrutura de inventario | Persistir em backend | Alta |
| `it_guardian_active_inventory_tab` | `App.jsx` | Aba ativa do usuario | Preferencia visual | Pode continuar no frontend | Baixa |
| `it_guardian_asset_id`, `it_guardian_machine_name`, `it_guardian_asset_tag`, `it_guardian_environment_name` | `PublicSupportRequest.jsx` | Contexto local do atalho/chamado publico | Contexto de dispositivo | Pode continuar ate existir agente/atalho real | Baixa |

Chaves removidas do uso atual em `localStorage`: `it_guardian_system_mode`, `it_guardian_priority_colors` e `it_guardian_problem_categories`.

## Mocks e dados demo

| Local | Dado | Uso atual | Recomendacao |
| --- | --- | --- | --- |
| `server/src/data/mockOcs.js` | Maquinas e inventario OCS simulados | Demonstracao e desenvolvimento | Manter como fallback; substituir por OCS real na Fase 4 |
| `server/src/data/mockZabbix.js` | Hosts e alertas simulados | Dashboard e alertas | Manter como fallback; integrar Zabbix real depois |
| `server/src/integrations/ping/PingService.js` | Ping mockado | Status visual e manual assets | Manter no Vercel; ping real exige VPS/coletor |
| `server/src/repositories/demoDataRepository.js` | Grupos, segmentos, OS, clientes, pecas, servicos, backups | Seed de ambiente demo | Manter apenas para desenvolvimento/demo |
| `server/src/repositories/manualAssetRepository.js` | Ativos manuais demo | Seed inicial | Manter demo; separar seed de producao |
| `server/src/repositories/userRepository.js` | Usuarios ficticios | Testes de permissoes | Manter em seed de desenvolvimento; nao rodar em producao real |
| `PublicSupportRequest.jsx` | Categorias e tipos fallback | Resiliencia se API falhar | Manter fallback simples |
| `ServiceOrdersBoard.jsx` e `ServiceOrderDetailsModal.jsx` | Status fallback | Resiliencia visual | Manter fallback, mas backend deve decidir |

## Regras de negocio no frontend

| Regra | Local atual | Destino ideal |
| --- | --- | --- |
| Abas/ambientes do inventario | `App.jsx` | Backend: `inventory_tabs` e relacionamentos |
| Metadados de abas, grupos, segmentos e maquinas | `App.jsx` | Backend |
| Manutencao local e retorno de segmento | `App.jsx` | Backend, junto com OS/manutencao |
| Backup visual e uso de maquinas reserva | `App.jsx` e componentes de inventario | Backend para estado; frontend apenas exibe |
| Drag-and-drop e estado visual durante arraste | Frontend | Deve ficar no frontend |
| Filtros de tela de inventario/OS | Frontend | Pode ficar no frontend, desde que API respeite permissao |
| Validacoes visuais de formulario | Frontend | Pode ficar duplicado, mas backend decide |
| Modo Local/Business | Antes localStorage; agora `/api/system-settings` | Backend como fonte da verdade |
| Permissoes de menu/botoes | Frontend | Frontend exibe/esconde, backend bloqueia |
| Prioridade automatica | Backend em `serviceOrderRepository.js` | Backend |
| Numero da OS | Backend em `serviceOrderRepository.js` | Backend, precisa reforco transacional |
| Status inicial/final da OS | Backend em `app_settings` | Backend |
| Historico da OS | Backend em `service_order_history` | Backend |
| Valores de servico/pecas | Backend em `service_orders` e `service_order_items` | Backend |
| Clientes permitidos por tecnico | Backend em `technicians.allowed_client_ids` | Backend |

## Configuracoes mapeadas

### Podem continuar no frontend

- Tema claro/noturno depois do login.
- Preset visual e cores customizadas por usuario.
- Tamanho geral de fonte.
- Aba ativa do inventario.
- Estado aberto/fechado de accordions e modais.

### Devem ficar no backend

- Modo Local/Business.
- Usuarios, setores, administradores e permissoes.
- Formato do numero da OS.
- Proximo numero da OS.
- Status/segmentos da OS.
- Prioridade automatica e tempos.
- Cores de prioridade.
- Visualizacao horizontal/vertical do painel de OS, se for preferencia do sistema.
- Clientes, tecnicos, produtos/pecas, servicos, tipos de problema e regras de prioridade.
- Historico da OS.
- Vinculo OS com maquina.
- Manutencao/backup ligada a OS.
- Historico tecnico da maquina.

## Backend atual

Ja existem rotas e tabelas para:

- `users`
- `sectors`
- `service_orders`
- `service_order_history`
- `service_order_items`
- `app_settings`
- `clients`
- `products`
- `service_catalog`
- `technicians`
- `problem_types`
- `priority_rules`
- `inventory_segments`
- `device_metadata`
- `asset_history`

Rotas principais ja protegidas por permissao:

- Inventario: `inventory.view`, `inventory.create_asset`, `inventory.edit_asset`, `inventory.move_assets`, `inventory.manage_segments`, `inventory.view_machine`.
- Ordens de Servico: `service_orders.view`, `service_orders.create`, `service_orders.edit`, `service_orders.change_status`, `service_orders.attendance`, `service_orders.settings`.
- Admin: rotas de usuarios/setores usam admin.
- Configuracao do modo: `PATCH /api/system-settings` usa `settings.system_mode`.

## Riscos tecnicos

1. **Concorrencia da numeracao da OS**: o backend incrementa o proximo numero em `app_settings`, mas ainda precisa de transacao/lock para alta concorrencia.
2. **Inventario ainda parcialmente local**: abas, metadados e manutencao podem mudar por navegador.
3. **Primeiro admin em producao real**: seeds demo nao rodam em producao, entao o proximo passo e criar um fluxo seguro e explicito para provisionar o primeiro administrador real.
4. **Algumas mensagens ainda precisam revisao de acentos**: nao afeta regra, mas impacta polimento.
5. **OCS/Zabbix/ping continuam mockados**: esperado ate a implementacao real com coletor/VPS.
6. **Historico da maquina ainda nao cobre tudo**: a OS ja registra eventos importantes, mas inventario precisa consolidar historico real.

## Prioridade de migracao

### Prioridade 1 - Critico

- Finalizar persistencia completa de modo Local/Business no backend. **Concluido nesta rodada.**
- Reforcar numeracao da OS com transacao/lock.
- Garantir que toda configuracao de OS use backend como fonte.
- Migrar manutencao e backup ativos para backend.
- Impedir seeds demo em producao real. **Concluido: seeds demo ficam fora de ambientes production-like.**

### Prioridade 2 - Importante

- Migrar abas/ambientes do inventario.
- Migrar apelidos, observacoes e historico de perifericos para `device_metadata`/`asset_history`.
- Separar preferencias visuais por usuario autenticado, se necessario.
- Adicionar endpoints dedicados para itens/status da OS, caso o frontend deixe de usar `PATCH /api/service-orders/:id`.

### Prioridade 3 - Futuro

- OCS real.
- Zabbix real.
- Ping real.
- Coletor por cliente.
- Dashboard com metricas reais.
- Relatorios e indicadores por setor/cliente.

## Ordem recomendada

1. Congelar Fase 2 com build verde.
2. Proteger producao contra `DATABASE_URL=memory` e seeds demo automaticos. **Concluido nesta rodada.**
3. Reforcar transacao de numeracao de OS.
4. Migrar manutencao/backup do inventario.
5. Migrar abas/ambientes do inventario.
6. Integrar ping/OCS/Zabbix reais em adaptadores, mantendo fallback mock.
