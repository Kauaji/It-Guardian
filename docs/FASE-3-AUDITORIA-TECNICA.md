# Fase 3 - Auditoria Tecnica

Auditoria documental do IT Guardian para mapear o que ainda esta no frontend,
em `localStorage`, mockado, hardcoded ou como regra de negocio no React.

Esta auditoria nao implementa migracao, nao altera comportamento e serve como
base para decidir a ordem segura de migracao para backend.

## Legenda de classificacao

| Classe | Significado |
| --- | --- |
| 1 | Pode ficar no frontend. |
| 2 | Deve ir para backend agora. |
| 3 | Pode ir para backend depois. |
| 4 | Pode continuar mockado ate integracao real. |

## Resumo executivo

- Ordens de Servico ja usam API como fonte principal para criacao, numero, status, historico, itens, setor, cliente, servico e configuracoes.
- Usuarios, setores e permissoes ja existem no backend e tem middleware de permissao.
- Usuarios, setores e permissoes foram reforcados: senha segue com hash, usuario inativo nao loga, setor inativo nao herda permissoes, permissao `admin.*` nao vale para usuario comum e o ultimo admin ativo e protegido.
- Cadastro publico foi limitado ao primeiro administrador; depois disso, criacao/edicao/desativacao de usuarios passa por `/api/users` com autenticacao e administrador real.
- Modo Local/Business ja vem de `/api/system-settings`.
- Configuracoes da OS ja usam `/api/service-order-settings`, `/api/service-order-statuses`, `/api/services` e rotas relacionadas.
- Configuracoes de regra foram consolidadas no backend: leitura de OS settings exige `service_orders.view`, alteracao exige `service_orders.settings`, status em uso nao pode ser removido e servicos possuem codigo unico.
- O Inventario ainda e a area mais local: abas, metadados de aba, manutencao local, observacoes, apelidos e historico de perifericos dependem do navegador.
- O fluxo de manutencao/backup vinculado a OS ainda tem muita orquestracao em `client/src/App.jsx`, embora parte do estado de backup ja esteja em `device_metadata`.
- OCS, Zabbix e ping continuam mockados por desenho da fase atual.
- O frontend ainda possui copias/fallbacks de permissoes, status da OS, categorias e presets para manter a tela funcionando, mas o backend deve continuar sendo a autoridade.

## localStorage

| Chave | Arquivo principal | Dado salvo | Classe | Recomendacao | Risco |
| --- | --- | --- | --- | --- | --- |
| `it_guardian_token` | `client/src/App.jsx` | JWT da sessao | 1 | Pode ficar no frontend por enquanto; avaliar cookie httpOnly futuramente. | Exposicao via XSS se houver vulnerabilidade no app. |
| `it_guardian_user` | `client/src/App.jsx` | Snapshot do usuario logado | 1 | Manter apenas como cache de sessao; backend segue como fonte. | Pode ficar defasado ate recarregar/validar token. |
| `it_guardian_theme` | `client/src/App.jsx`, `GeneralSettingsModal.jsx` | Tema claro/escuro | 1 | Preferencia visual pode ficar local. | Baixo. |
| `it_guardian_general_preferences` | `GeneralSettingsModal.jsx` | Tamanho de fonte, preset visual e tema customizado | 1 | Pode ficar local; migrar para preferencia por usuario se necessario. | Preferencia nao acompanha outro navegador. |
| `it_guardian_accent_color` | `GeneralSettingsModal.jsx` | Cor de destaque customizada | 1 | Pode ficar local. | Baixo. |
| `it_guardian_machine_aliases` | `client/src/App.jsx` | Apelidos/nomes amigaveis de maquinas | 3 | Migrar para `device_metadata` depois da estabilizacao principal do inventario. | Apelido muda por navegador. |
| `it_guardian_machine_observations` | `client/src/App.jsx` | Observacoes adicionadas na ficha da maquina | 2 | Migrar para `asset_history` ou tabela propria de observacoes. | Observacoes tecnicas podem se perder ou divergir por navegador. |
| `it_guardian_removed_peripherals` | `client/src/App.jsx` | Perifericos removidos localmente | 2 | Migrar para backend/historico do ativo. | Estado tecnico inconsistente entre usuarios. |
| `it_guardian_peripheral_history` | `client/src/App.jsx` | Historico local de perifericos | 2 | Migrar para `asset_history`. | Historico tecnico nao auditavel. |
| `it_guardian_inventory_tabs` | `client/src/App.jsx` | Abas/ambientes do inventario | 2 | Criar persistencia real para abas/ambientes. | Estrutura do inventario muda por navegador. |
| `it_guardian_inventory_tab_meta` | `client/src/App.jsx` | Vinculo de grupos, segmentos e maquinas com abas | 2 | Migrar para backend junto com abas/ambientes. | Segmentos e maquinas podem aparecer em ambientes diferentes para cada usuario. |
| `it_guardian_active_inventory_tab` | `client/src/App.jsx` | Aba ativa do usuario | 1 | Pode continuar como preferencia visual. | Baixo. |
| `it_guardian_maintenance_records` | `client/src/App.jsx` | Origem/local de maquina em manutencao | 2 | Migrar para backend junto com manutencao/OS. | Maquina pode ficar presa ou voltar para local errado em outro navegador. |
| `it_guardian_asset_id` | `PublicSupportRequest.jsx` | Contexto local do ativo para abertura publica | 4 | Manter ate existir agente/atalho real. | Baixo enquanto for fallback de desenvolvimento. |
| `it_guardian_machine_name` | `PublicSupportRequest.jsx` | Nome da maquina no formulario publico | 4 | Manter ate existir agente/atalho real. | Baixo. |
| `it_guardian_asset_tag` | `PublicSupportRequest.jsx` | Patrimonio no formulario publico | 4 | Manter ate existir agente/atalho real. | Baixo. |
| `it_guardian_environment_name` | `PublicSupportRequest.jsx` | Ambiente/cliente no formulario publico | 4 | Manter ate existir agente/atalho real. | Pode gerar OS com contexto incompleto se usado como fonte real. |

Chaves antigas nao encontradas no uso atual: `it_guardian_system_mode`,
`it_guardian_priority_colors`, `it_guardian_problem_categories`,
`it_guardian_asset_aliases` e `it_guardian_asset_observations`.

## Mocks e dados demo

| Local | Dado mockado/demo | Classe | Recomendacao | Risco |
| --- | --- | --- | --- | --- |
| `server/src/data/mockOcs.js` | Inventario OCS simulado | 4 | Manter ate integracao OCS real. | Dados de infraestrutura nao representam ambiente real. |
| `server/src/data/mockZabbix.js` | Hosts, alertas e historico Zabbix simulados | 4 | Manter ate integracao Zabbix real. | Dashboard/alertas sao demonstrativos. |
| `server/src/integrations/ping/PingService.js` | Ping simulado por IP/hash | 4 | Manter ate VPS/coletor/agente real. | Status pode parecer real sem ser. |
| `server/src/repositories/demoDataRepository.js` | Grupos, segmentos, OS, clientes, pecas, servicos e backups de demo | 4 | Manter apenas fora de producao. | Seed demo em producao causaria dados falsos. |
| `server/src/repositories/manualAssetRepository.js` | Ativos manuais iniciais de demo | 4 | Manter como seed de desenvolvimento. | Baixo se production-like continuar bloqueando seed demo. |
| `server/src/repositories/userRepository.js` | Usuarios ficticios de teste | 4 | Manter apenas ambiente demo/dev. | Contas demo nao podem existir em producao real. |
| `server/src/repositories/sectorRepository.js` | Setores padrao com permissoes iniciais | 3 | Pode ficar como bootstrap controlado; revisar para multiempresa. | Permissoes iniciais podem nao servir para todas empresas. |
| `PublicSupportRequest.jsx` | Categorias e tipos de problema fallback | 4 | Manter fallback ate API/configuracao real estar sempre disponivel. | Prioridade visual pode divergir da regra real. |
| `server/src/controllers/publicServiceOrderController.js` | Categorias/tipos fallback para formulario publico | 4 | Manter fallback, mas preferir dados configurados. | Baixo, desde que prioridade final seja backend. |
| `ServiceOrdersBoard.jsx` | Status, cores e formato de OS fallback | 4 | Manter como fallback visual; backend deve decidir. | Tela pode exibir padrao antigo se API falhar. |
| `GeneralSettingsModal.jsx` | Presets de aparencia e tema padrao | 1 | Pode ficar no frontend. | Baixo. |
| `SettingsView.jsx` | Configuracao visual de campos/tabelas das abas da OS | 1 | Pode ficar no frontend como esquema de tela. | Baixo, desde que API valide. |

## Dados hardcoded relevantes

| Item | Local | Classe | Observacao |
| --- | --- | --- | --- |
| `permissionGroups` e permissoes padrao | `client/src/permissions.js` e `server/src/permissions.js` | 3 | Backend valida, mas ha duplicacao. Ideal: frontend consumir sempre `/api/permissions` ou usar pacote compartilhado. |
| `roleDefaultPermissions` | `client/src/permissions.js` e `server/src/permissions.js` | 3 | Risco de divergencia entre menu visivel e permissao real. |
| Aliases de permissoes legadas | `client/src/permissions.js` e `server/src/permissions.js` | 3 | `inventory.print_qr`, `service_orders.close` e `settings.general` sao aceitos como compatibilidade e normalizados para IDs canonicos. |
| `backupSegmentId = "system-backup"` e `backupSegmentName = "Backup"` | `client/src/App.jsx` | 2 | Segmento/area Backup deve ser entidade/regra do backend. |
| Nomes reservados `manutencao` e `nao organizadas` | `client/src/App.jsx` e `segmentRepository.js` | 1 | Duplicacao aceitavel para UX, pois backend tambem bloqueia. |
| `defaultInventoryTab` e `segmentPalette` | `client/src/App.jsx` | 2 para aba, 1 para paleta | Aba padrao e estrutura devem ir para backend; paleta pode ficar no frontend. |
| `defaultProblemCategories` | `SettingsView.jsx`, `PublicSupportRequest.jsx`, `publicServiceOrderController.js` | 3 | Pode virar configuracao/cadastro no backend depois. |
| `ruleTypeOptions` | `SettingsView.jsx` | 1 | E esquema de UI; backend deve validar valores. |
| Labels de status/prioridade | varios componentes | 1 | Pode ficar no frontend como apresentacao. |
| `readSystemMode()` retornando `local` como fallback | `App.jsx`, `PublicSupportRequest.jsx` | 1 | Aceitavel como fallback inicial; API sobrescreve. |

## Regras de negocio ainda no frontend

### Ordens de Servico

| Regra | Local | Classe | Estado atual / risco |
| --- | --- | --- | --- |
| Filtros visuais por mes, setor, cliente, prioridade, tecnico e status | `ServiceOrdersBoard.jsx` | 1 | Pode ficar no frontend, desde que backend continue filtrando permissao de acesso. |
| Normalizacao visual de status e cores | `ServiceOrdersBoard.jsx` | 4 | Fallback visual; backend e fonte da verdade. |
| Previa do numero da OS | `ServiceOrdersBoard.jsx` | 1 | E apenas preview; numero final deve continuar no backend. |
| Validacoes visuais de formulario de OS | `ServiceOrderFormModal.jsx` | 1 | Pode ficar duplicado para UX; backend deve validar. |
| Seletores/autocomplete de servico e pecas | `ServiceOrderDetailsModal.jsx` | 1 | UI. Backend controla dados salvos. |
| Valor de servico preenchido no atendimento | `ServiceOrderDetailsModal.jsx` | 1 | Pode ser ajuda visual; backend recalcula/retorna totais. |
| Ao criar/editar OS com maquina, colocar maquina em manutencao | `App.jsx` (`ensureMachineInMaintenanceForServiceOrder`) | 2 | Regra importante ainda orquestrada no React. Deve ir para backend para evitar divergencia entre usuarios. |
| Ao finalizar OS, retirar maquina da manutencao | `App.jsx` (`handleChangeServiceOrderStatus`, `removeMachineFromMaintenance`) | 2 | Deve virar efeito transacional no backend. |
| Bloquear exclusao de OS com backup/manutencao ativa | `App.jsx` (`handleDeleteServiceOrder`) | 2 | Backend deve impedir ou exigir confirmacao/parametro explicito. |
| Selecionar/devolver maquina Backup na OS | `App.jsx` (`handleSelectBackupForServiceOrder`, `releaseBackupForServiceOrder`) | 2 | Parte do estado vai para API, mas a regra completa ainda esta no frontend. |
| Historico local de maquina durante eventos de OS | `App.jsx` (`appendDeviceHistoryEvent`) | 2 | Backend ja tem `asset_history`; frontend ainda adiciona eventos locais para alguns fluxos. |
| Exigencia de cliente no formulario publico em modo Business | `PublicSupportRequest.jsx` | 2 | Hoje ha bloqueio no frontend; backend publico deve validar para chamadas diretas. |
| Prioridade exibida no formulario publico por tipo de problema | `PublicSupportRequest.jsx` | 1 | Pode ser preview. Backend calcula prioridade real em `publicServiceOrderController.js`. |

### Inventario

| Regra | Local | Classe | Estado atual / risco |
| --- | --- | --- | --- |
| Abas/ambientes do inventario | `App.jsx` (`inventoryTabs`) | 2 | Deve migrar para backend. Hoje e por navegador. |
| Vinculo de grupos/segmentos/maquinas por aba | `App.jsx` (`inventoryTabMeta`) | 2 | Deve migrar junto com abas. |
| Aba ativa | `App.jsx` (`activeInventoryTabId`) | 1 | Preferencia local aceitavel. |
| Manutencao manual de maquina | `App.jsx` (`handleToggleMaintenance`, `maintenanceRecords`) | 2 | Deve migrar para backend. |
| Origem/retorno de manutencao | `App.jsx` (`maintenanceRecords`) | 2 | Risco alto de retorno incorreto se outro usuario finaliza OS. |
| Marcar/remover Backup | `App.jsx` + `updateDeviceBackup` | 2 | Estado basico ja persiste; regras de alocacao ainda devem ir para backend. |
| Drag-and-drop visual | `useInventoryDragAndDrop.js`, `App.jsx` | 1 | Pode ficar no frontend; backend so precisa receber o movimento final. |
| Movimento de maquinas entre segmentos | `App.jsx` chama `/api/devices/:id/segment` | 1/2 | Chamada final ja vai para backend; propriedade de aba ainda local deve migrar. |
| Selecao multipla e overlay de drag | componentes de inventario | 1 | Estado puramente visual. |
| Apelidos de maquina | `App.jsx` | 3 | Pode ir depois para `device_metadata`. |
| Observacoes da maquina | `App.jsx` | 2 | Deve ir para backend para auditoria. |
| Remocao/historico de perifericos | `App.jsx` | 2 | Deve ir para backend/historico do ativo. |
| Nomes reservados de segmentos | `App.jsx`, `segmentRepository.js` | 1 | Backend ja protege; frontend ajuda a UX. |

### Usuarios, permissoes e configuracoes

| Regra | Local | Classe | Estado atual / risco |
| --- | --- | --- | --- |
| Esconder menus/botoes por permissao | `App.jsx`, `ServiceOrdersBoard.jsx`, `GeneralSettingsModal.jsx` | 1 | Deve ficar no frontend como UX; backend ja bloqueia. |
| Definicao de permissoes para exibir checklist | `client/src/permissions.js` | 3 | Pode ficar como fallback, mas ideal e consumir backend sempre. |
| Admin visivel apenas para admin | `GeneralSettingsModal.jsx` | 1 | UX; backend tambem exige admin. |
| Preferencias visuais gerais | `GeneralSettingsModal.jsx` | 1 | Podem ficar no frontend. |
| Modo Local/Business | `App.jsx` chama `/api/system-settings` | 1 | Frontend apenas exibe/aplica; backend e fonte. |
| Configuracoes da OS | `ServiceOrdersBoard.jsx` chama `/api/service-order-settings` | 1 | Frontend edita e envia; backend valida. |

## Configuracoes que devem estar no backend

Ja estao no backend como fonte principal:

- Modo Local/Business.
- Usuarios, setores, administradores e permissoes.
- Status inicial/final da OS.
- Formato e numeracao da OS.
- Historico da OS.
- Itens/pecas da OS.
- Clientes, tecnicos, produtos, servicos, tipos de problema e regras de prioridade.
- Configuracoes de prioridade automatica e cores de prioridade.
- Regras de integridade dos status: limite de 10, exatamente um inicial/final e bloqueio de remocao quando houver OS vinculada.
- Codigo e valor padrao de servicos, incluindo geracao automatica de codigo e rejeicao de duplicidade.

Ainda devem ir para backend:

- Abas/ambientes do inventario.
- Relacao de abas com grupos, segmentos e maquinas.
- Estado completo de manutencao da maquina.
- Regra completa de Backup usado por OS.
- Observacoes de maquina.
- Historico de perifericos e perifericos removidos.
- Validacao do formulario publico em modo Business.
- Regras transacionais de exclusao de OS com maquina/backup vinculado.
- Lock distribuido/advisory lock para numeracao de OS, se o deploy passar a rodar multiplas instancias simultaneas.

Podem continuar no frontend:

- Tema, preset visual e tamanho de fonte.
- Paleta visual sugerida para segmentos.
- Estado aberto/fechado de modais, accordions e filtros.
- Drag-and-drop visual e overlay.
- Filtros de tela, desde que API aplique permissao.
- Preview visual de numero/prioridade.

Podem continuar mockados ate integracao real:

- OCS.
- Zabbix.
- Ping real.
- Seeds demo de ambiente local.
- Contexto de maquina vindo de atalho/localStorage no formulario publico.

## Backend atual mapeado

Tabelas/estruturas ja existentes:

- `users`
- `sectors`
- `audit_logs`
- `inventory_segments`
- `segment_groups`
- `device_segments`
- `manual_network_assets`
- `device_metadata`
- `asset_history`
- `service_orders`
- `service_order_history`
- `service_order_items`
- `app_settings`
- `service_order_settings`
- `service_order_statuses`
- `clients`
- `products`
- `service_catalog`
- `technicians`
- `problem_types`
- `priority_rules`

Rotas com protecao relevante:

- Inventario: `/api/devices`, `/api/segments`.
- OS: `/api/service-orders`, `/api/service-order-settings`, `/api/service-order-statuses`.
- Cadastros de OS: `/api/clients`, `/api/products`, `/api/services`, `/api/technicians`, `/api/problem-types`, `/api/priority-rules`.
- Admin: `/api/users`, `/api/sectors`, `/api/permissions`.
- Sistema: `/api/system-settings`.

Permissoes relevantes:

- `GET /api/system-settings`: usuario autenticado.
- `PATCH /api/system-settings`: `settings.system_mode`.
- `GET /api/service-order-settings`: `service_orders.view`.
- `PATCH /api/service-order-settings`: `service_orders.settings`.
- `GET /api/service-order-statuses`: `service_orders.view`.
- Mutacoes de status, servicos, clientes, tecnicos, produtos, tipos de problema e regras de prioridade: `service_orders.settings`.

## Riscos tecnicos

1. **Inventario dividido por navegador**: abas e metadados de abas estao em `localStorage`.
2. **Manutencao/Backup ainda orquestrados no React**: outro usuario ou chamada direta de API pode deixar estados inconsistentes.
3. **Formulario publico com regra critica no frontend**: modo Business exige cliente no React, mas a API publica tambem precisa validar isso.
4. **Permissoes duplicadas**: `client/src/permissions.js` e `server/src/permissions.js` podem divergir.
5. **Mocks parecem reais na interface**: OCS, Zabbix e ping devem continuar identificados como mock ate integracao real.
6. **Numeracao da OS em ambiente distribuido**: o backend gera numero, usa indice unico e tenta novamente em colisao; em multiplas instancias, avaliar advisory lock/transacao dedicada.
7. **Dados tecnicos locais podem se perder**: observacoes, perifericos removidos e historico local nao sao auditaveis no backend.
8. **Sessao em localStorage**: aceitavel para MVP, mas cookie httpOnly seria mais seguro para producao.

## Recomendacao de migracao futura

### Migrar agora - Classe 2

1. Validacao do formulario publico no backend para modo Business.
2. Manutencao e retorno de manutencao vinculados a OS.
3. Fluxo completo de Backup vinculado a OS.
4. Abas/ambientes do inventario e metadados de pertencimento.
5. Observacoes, perifericos removidos e historico de perifericos.
6. Regras de exclusao de OS com maquina/backup/manutencao ativa.
7. Monitorar numeracao da OS em deploy multi-instancia e evoluir para advisory lock se necessario.

### Migrar depois - Classe 3

1. Apelidos de maquina.
2. Preferencias visuais por usuario, se necessario.
3. Categorias padrao como cadastro configuravel.
4. Unificar definicao de permissoes entre frontend e backend.

### Manter no frontend - Classe 1

1. Tema e aparencia.
2. Drag-and-drop visual.
3. Filtros e busca de tela.
4. Modais, accordions e estados de UI.
5. Previews e labels visuais.

### Manter mockado ate integracao real - Classe 4

1. OCS.
2. Zabbix.
3. Ping real.
4. Seeds demo.
5. Contexto local de atalho do formulario publico.

## Conclusao

A Fase 3 ja moveu as regras centrais de OS, usuarios, setores, permissoes,
modo do sistema e configuracoes da OS para o backend. O maior bloco pendente
nao e mais OS pura, e sim a integracao entre OS e Inventario: manutencao,
backup, historico tecnico da maquina e ambientes/abas do inventario.

Na rodada de hardening de permissoes, o backend passou a bloquear cadastro
publico depois do primeiro administrador, filtrar `admin.*` de usuarios comuns,
ignorar permissoes herdadas de setores inativos e retornar apenas objetos
publicos de usuario nas rotas administrativas.

Na rodada de consolidacao de configuracoes, regras de sistema e OS foram
confirmadas como persistidas no backend. Preferencias visuais simples seguem
no frontend por decisao de baixo risco.

Na auditoria final de 30/05/2026, foram revalidados build, smoke test de API
em banco `memory`, bloqueios de permissao, OS com numero gerado no backend,
servico com valor/prioridade padrao, itens, historico, `closed_at`, bloqueio
de status em uso e protecoes de producao contra `DATABASE_URL=memory` e
`JWT_SECRET` inseguro.

A partir daqui, a proxima migracao recomendada e Inventario operacional:
manutencao, Backup, historico tecnico da maquina e abas/ambientes. OCS,
Zabbix, ping real e coletor devem continuar fora do escopo ate essa fronteira
OS-Inventario estar mais solida.
