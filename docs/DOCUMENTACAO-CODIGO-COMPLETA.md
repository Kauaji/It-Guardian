# Documentação completa do código - IT Guardian

Este documento explica a estrutura técnica do IT Guardian e o papel dos principais arquivos, funções, componentes e fluxos do sistema. Ele foi escrito para servir como referência de manutenção da Fase 2 completa, mantendo a visão do que já existe e do que foi preparado para as próximas fases.

## Visão geral

O IT Guardian é um MVP full-stack com frontend React/Vite e backend Express. A aplicação cobre login, permissões, inventário, alertas, configurações gerais, configurações de Ordens de Serviço, abertura pública de chamado e o fluxo técnico de atendimento.

O frontend é responsável pela experiência visual, modais, filtros, interações, drag-and-drop e chamadas HTTP. O backend é responsável por autenticação, permissões, validações, persistência, numeração de OS, status, histórico, cadastros e regras principais.

## Estrutura do repositório

```text
api/
  index.js                         Entrada serverless usada pelo Vercel.

client/
  src/
    App.jsx                        Componente raiz autenticado.
    api.js                         Cliente HTTP centralizado.
    permissions.js                 Leitura de permissões no frontend.
    components/
      inventory/                   Inventário, cards, abas, segmentos e ficha.
      serviceOrders/               Ordens de Serviço.
      settings/                    Configurações gerais e configurações da OS.
      public/                      Abertura pública de chamado.
    styles.css                     Estilos globais.

server/
  src/
    app.js                         Express app e registro das rotas.
    server.js                      Inicialização local com app.listen.
    bootstrap.js                   Inicialização idempotente de banco e seeds.
    database.js                    Conexão e criação das tabelas.
    permissions.js                 Matriz de permissões do backend.
    config/                        Ambiente, CORS, JWT e banco.
    controllers/                   Controllers HTTP.
    routes/                        Rotas Express.
    repositories/                  Persistência e regras de dados.
    services/                      Orquestração de domínio.
    integrations/                  Adaptadores mock/futuros para OCS, Zabbix e ping.
```

## Fluxo de inicialização

1. `api/index.js` importa o app Express para execução serverless no Vercel.
2. `server/src/server.js` cria o servidor local e chama `initializeRuntime`.
3. `server/src/app.js` cria o Express, aplica middlewares, registra rotas e handlers de erro.
4. `server/src/bootstrap.js` executa `initializeDatabase`, valida JWT e semeia dados demo quando permitido.
5. `server/src/database.js` cria ou conecta no PostgreSQL. Em desenvolvimento, pode usar `pg-mem` com `DATABASE_URL=memory`.

## Backend

### `server/src/app.js`

- `buildCorsOptions()`: monta a regra de CORS usando origens permitidas do ambiente e domínios Vercel.
- `createApp({ initializeOnRequest })`: instancia o Express, aplica `helmet`, `cors`, JSON parser, `morgan`, rota de health check e todas as rotas `/api`.

Rotas registradas:

- `/api/public`
- `/api/auth`
- `/api/devices`
- `/api/alerts`
- `/api/logs`
- `/api/users`
- `/api/permissions`
- `/api/sectors`
- `/api/segments`
- `/api/service-orders`
- `/api/service-order-settings`
- `/api/service-order-statuses`
- `/api/system-settings`
- `/api/clients`
- `/api/products`
- `/api/services`
- `/api/technicians`
- `/api/problem-types`
- `/api/priority-rules`

### `server/src/database.js`

- `createPool()`: escolhe `pg-mem` em modo memória ou `pg` com `DATABASE_URL`.
- `getPool()`: mantém uma única promessa de pool reutilizável.
- `query(text, params)`: executa SQL.
- `queryIgnoringDuplicateConstraint(text, params)`: ignora erros esperados de constraints já existentes.
- `initializeDatabase()`: cria e atualiza todas as tabelas usadas pelo sistema.

Principais tabelas:

- `users`
- `sectors`
- `audit_logs`
- `alert_acknowledgements`
- `segment_groups`
- `inventory_segments`
- `device_segments`
- `manual_network_assets`
- `device_metadata`
- `asset_history`
- `service_orders`
- `service_order_history`
- `service_order_items`
- `service_order_settings`
- `service_order_statuses`
- `app_settings`
- `clients`
- `products`
- `service_catalog`
- `technicians`
- `problem_types`
- `priority_rules`

### `server/src/bootstrap.js`

- `initializeRuntime()`: garante execução única do bootstrap. Valida segredo JWT, inicializa banco, cria setores padrão e, em ambiente demo/desenvolvimento, cria usuários, segmentos, ativos manuais e dados operacionais.

### Configuração de ambiente

Arquivo: `server/src/config/environment.js`.

- `shouldSeedDemoData()`: decide se seeds demo devem rodar.
- `getFrontendUrl()`: resolve a URL pública do frontend.
- `getCorsOrigins()`: lista origens aceitas no CORS.
- `isAllowedVercelOrigin(origin)`: permite domínios Vercel válidos.
- `getJwtSecret()`: exige segredo JWT em ambientes reais.
- `resolveDatabaseConfig()`: resolve modo `memory` ou PostgreSQL com SSL.

## Autenticação e permissões

### `server/src/controllers/authController.js`

- `signToken(user)`: assina JWT com `sub`, `email` e `role`.
- `register(req, res, next)`: cria o primeiro administrador quando ainda não existe admin ativo.
- `login(req, res, next)`: valida e-mail, senha hash e usuário ativo.
- `me(req, res)`: devolve o usuário autenticado.

### `server/src/middleware/authMiddleware.js`

- `normalizeClientIds(value)`: normaliza clientes permitidos de técnicos.
- `requireAuth(req, res, next)`: valida JWT, carrega usuário e permissões efetivas.
- `requireRole(...roles)`: bloqueia por perfil.
- `requireAdmin(req, res, next)`: libera apenas administradores.
- `requirePermission(permission)`: bloqueia endpoint quando o usuário não possui permissão.

### `server/src/permissions.js`

- `permissionGroups`: catálogo de permissões agrupadas.
- `allPermissionIds`: lista plana de permissões.
- `legacyPermissionAliases`: compatibilidade com nomes antigos.
- `normalizePermissions(value)`: limpa, canoniza e remove permissões inválidas.
- `getRolePermissions(role)`: permissões padrão por papel.
- `getEffectivePermissions(user)`: soma papel, setor e permissões individuais.
- `hasPermission(user, permission)`: valida acesso final.

Regra final:

- Admin tem tudo.
- Usuário inativo não tem acesso.
- Usuário comum recebe permissões por papel, setor e permissões individuais.
- Permissões `admin.*` não são concedidas a não administradores.

## Usuários e setores

### Controllers

`server/src/controllers/userController.js`

- `ensureRole(role)`: garante papel válido.
- `ensureNotRemovingLastAdmin(userId, payload)`: impede remover/desativar último admin.
- `list`: lista usuários.
- `createManaged`: cria usuário pelo Admin.
- `updateAccess`: edita dados de acesso.
- `updatePermissions`: altera permissões individuais.
- `updateRole`: altera papel.
- `removeManaged`: desativa usuário com proteção do último admin.

`server/src/controllers/sectorController.js`

- `list`: lista setores.
- `create`: cria setor.
- `update`: edita setor.
- `updatePermissions`: altera permissões padrão do setor.
- `remove`: desativa setor.

### Repositórios

`server/src/repositories/userRepository.js`

- `listUsers()`: lista usuários com dados de setor.
- `findUserByEmail(email)`: busca por e-mail.
- `findUserById(id)`: busca por ID.
- `createUser(payload)`: cria usuário com senha hash.
- `updateUserRole(id, role)`: altera papel.
- `updateUserAccess(id, payload)`: edita nome, status, setor, cargo e admin.
- `updateUserPermissions(id, permissions)`: persiste permissões individuais.
- `deactivateUser(id)`: desativa usuário.
- `countActiveAdminsExcluding(userId)`: conta admins ativos exceto um ID.
- `seedDefaultAdmin()`: cria admin demo.
- `seedDemoUsers()`: cria usuários fictícios de teste.
- `toPublicUser(user)`: remove dados sensíveis.
- `fromRow(row)`: normaliza linha SQL.

`server/src/repositories/sectorRepository.js`

- `listSectors()`: lista setores.
- `findSectorById(id)`: busca setor.
- `findSectorByName(name)`: busca por nome.
- `createSector(payload)`: cria setor.
- `updateSector(id, payload)`: edita setor.
- `updateSectorPermissions(id, permissions)`: altera permissões.
- `deactivateSector(id)`: desativa setor.
- `seedDefaultSectors()`: cria setores padrão.
- `fromRow(row)`: normaliza linha SQL.

## Ordens de Serviço

### Frontend

`client/src/components/serviceOrders/ServiceOrdersBoard.jsx`

- `formatDate(value)`: formata datas dos cards.
- `getMonthValue(value)`: extrai `YYYY-MM`.
- `getCurrentBrowserMonth()`: mês atual do navegador.
- `normalizeSearchText(value)`: normaliza busca sem acentos.
- `normalizeSectorList(sectors)`: garante setor Geral.
- `orderBelongsToSector(order, sectorId)`: aplica filtro de setor.
- `orderBelongsToClient(order, clientId)`: aplica filtro de cliente.
- `getServiceLabel(order)`: monta rótulo de serviço.
- `formatMonthFilterLabel(value)`: texto do filtro de mês.
- `formatShortMonth(value)`: abrevia mês.
- `buildServiceOrderNumberPreview(settings)`: prévia visual de numeração.
- `normalizeStatuses(statuses)`: normaliza status configuráveis.
- `mergeServiceOrderSettings(settings)`: junta defaults e API.
- `ServiceOrderCard`: renderiza card do Kanban.
- `SettingsAccordionSection`: accordion das configurações da OS.
- `ServiceOrdersBoard`: tela completa de OS, filtros, Kanban, modal de criação, detalhe e configurações.

`client/src/components/serviceOrders/ServiceOrderFormModal.jsx`

- `getDeviceContext(device)`: extrai contexto de ativo.
- `ServiceOrderFormModal`: cria OS chamando API, com campos adaptados para modo Local/Business.

`client/src/components/serviceOrders/ServiceOrderDetailsModal.jsx`

- `formatDate(value)`: formata datas do detalhe.
- `DetailItem`: bloco visual de label/valor.
- `formatCurrency(value)`: formata moeda.
- `parseCurrency(value)`: converte texto monetário em número.
- `normalizeQuantity(value)`: normaliza quantidade de peças.
- `normalizeSearchText(value)`: busca sem acentos.
- `getProductPrice(product)`: resolve preço de produto.
- `normalizeItems(items)`: normaliza itens de OS.
- `escapeHtml(value)`: protege impressão HTML.
- `ServiceOrderDetailsModal`: modal de detalhe com abas Geral, Atendimento, Máquina e Histórico.

Comportamentos importantes:

- Em modo Local, campos financeiros ficam ocultos.
- Em modo Business, valores de serviço, peças e total estimado ficam visíveis.
- A busca de serviços e peças aceita seleção cadastrada ou texto manual.
- Histórico de OS e histórico de ativo aparecem em abas separadas.
- Impressão da OS gera HTML seguro com escape de conteúdo.

### Backend

`server/src/controllers/serviceOrderController.js`

- `validateCreatePayload(payload)`: exige título mínimo e prioridade válida.
- `validateStatus(status, settings)`: valida status configurado.
- `list`: lista OS respeitando permissão.
- `details`: carrega OS por ID.
- `settings`: devolve configurações da OS.
- `updateSettings`: salva configurações da OS.
- `create`: cria OS e registra log.
- `update`: edita OS, setor, prioridade, status e campos de atendimento.
- `changePriority`: endpoint específico para prioridade.
- `assignTechnician`: atribui técnico.
- `linkAsset`: vincula ativo.
- `replaceItems`: substitui itens/peças.
- `changeStatus`: muda status, valida técnico e finalização.
- `addHistory`: cria histórico manual e replica no ativo quando houver vínculo.
- `remove`: exclui OS com bloqueio quando houver backup em uso.

`server/src/repositories/serviceOrderRepository.js`

- `mergeServiceOrderSettings(value)`: junta configurações padrão e persistidas.
- `slugifyStatusId(value, fallback)`: cria ID seguro para status.
- `sanitizeStatusColor(value, fallback)`: valida cor hexadecimal.
- `normalizeStatus(status, index)`: normaliza status individual.
- `normalizeStatuses(statuses)`: garante status inicial/final e limite.
- `normalizeServiceOrderSettings(value)`: normaliza toda configuração da OS.
- `formatServiceOrderNumber(sequence, settings)`: gera número final.
- `withServiceOrderNumberLock(operation)`: evita duplicidade de número em concorrência local.
- `toMoneyValue(value)`: converte moeda.
- `normalizePriority(value, fallback)`: garante prioridade válida.
- `chooseHigherPriority(current, candidate)`: escolhe prioridade mais crítica.
- `getServiceOrderSettings()`: lê configuração.
- `updateServiceOrderSettings(payload)`: salva configuração.
- `getInitialStatus(settings)`: retorna status inicial.
- `getFinalStatus(settings)`: retorna status final.
- `hasServiceOrderStatus(settings, status)`: valida status.
- `listServiceOrders(user)`: lista OS conforme permissões, setor e clientes permitidos.
- `findServiceOrderById(id, user)`: busca detalhe com histórico e itens.
- `listServiceOrderItems(serviceOrderId)`: lista itens.
- `replaceServiceOrderItems(serviceOrderId, items)`: substitui itens.
- `listServiceOrderHistory(serviceOrderId)`: lista histórico.
- `addServiceOrderHistory(payload)`: registra evento.
- `createServiceOrder({ payload, user })`: cria OS, número, prioridade, status inicial e histórico.
- `updateServiceOrder({ id, payload, user })`: atualiza OS e registra histórico.
- `updateServiceOrderStatus({ id, status, user })`: troca status e define `closed_at` quando final.
- `deleteServiceOrder(id)`: remove OS.

### Status da OS

`server/src/controllers/serviceOrderStatusController.js`

- `slugifyStatusId(value, fallback)`: cria ID do status.
- `sanitizeStatusPayload(payload, fallbackOrder)`: normaliza payload.
- `applyExclusiveFlags(statuses, status)`: mantém um inicial e um final.
- `list`: lista status.
- `create`: cria status.
- `update`: edita status.
- `remove`: remove status.

Regras:

- Máximo de 10 status.
- Deve existir um status inicial.
- Deve existir um status final.
- Mover para status final registra encerramento da OS.

## Configurações da OS

`client/src/components/settings/SettingsView.jsx`

- `configs`: metadados das abas Clientes, Peças, Serviços, Técnicos, Tipos de problema e Regras de prioridade.
- `emptyRecord(config)`: cria registro vazio conforme campos.
- `renderCell(record, column)`: formata célula de tabela.
- `buildProblemCategories(records)`: monta categorias de problemas.
- `SettingsFormModal`: modal genérico de criação/edição.
- `SettingsView`: tela genérica de cadastros da OS.

No modo Local:

- Clientes ficam ocultos onde não fazem sentido.
- Campos financeiros ficam ocultos.

No modo Business:

- Clientes aparecem.
- Valores de serviços/produtos aparecem.
- Técnicos podem ter clientes permitidos.

## Abertura pública de chamado

### Frontend

`client/src/components/public/PublicSupportRequest.jsx`

- `findProblemType(problemTypes, value)`: encontra tipo de problema.
- `getFirstProblemTypeForCategory(problemTypes, category)`: escolhe primeiro tipo por categoria.
- `readSystemMode()`: lê modo do sistema para adaptar campos.
- `readMachineContext()`: lê contexto via query string.
- `buildRelatedAssetText(form)`: monta descrição de máquina relacionada.
- `PublicSupportRequest`: tela pública `/abrir-chamado`.

### Backend

`server/src/controllers/publicServiceOrderController.js`

- `trim(value)`: limpa texto.
- `normalize(value)`: normaliza texto para comparação.
- `sanitizePriority(value, fallback)`: valida prioridade.
- `uniqueCategories(problemTypes)`: monta categorias únicas.
- `chooseHigherPriority(current, candidate)`: escolhe prioridade mais alta.
- `getActiveProblemTypes()`: busca tipos ativos.
- `calculatePriority(payload)`: calcula prioridade pública.
- `supportOptions`: devolve opções para formulário público.
- `createPublicServiceOrder`: cria OS pública sem expor painel administrativo.

## Inventário

### Frontend

`client/src/App.jsx`

O `App` concentra o estado autenticado e orquestra:

- sessão (`it_guardian_token`, `it_guardian_user`);
- tema;
- alertas;
- dispositivos;
- segmentos;
- grupos;
- abas/ambientes;
- seleção múltipla;
- drag-and-drop;
- Ordens de Serviço;
- modais de inventário;
- chamadas para API.

Principais funções auxiliares:

- `pickSegmentColor(segments)`: escolhe cor de segmento.
- `pickUnusedPaletteColor(items)`: escolhe cor não usada.
- `normalizeMaintenanceName(name)`: normaliza nome de manutenção.
- `isMaintenanceSegmentName(name)`: detecta segmento Manutenção.
- `isReservedSegmentName(name)`: bloqueia nomes reservados.
- `getNextInventoryTabName(tabs)`: gera nome de aba.
- `readStoredJson(key, fallback)`: lê JSON do localStorage.
- `normalizeInventoryTabs(value)`: normaliza abas locais.
- `normalizeInventoryTabMeta(value)`: normaliza metadados locais.
- `keepDragOverlayNearCursor(args)`: posiciona overlay do drag perto do cursor.

`client/src/components/inventory/InventoryBoard.jsx`

- `SegmentGroupContainer`: área droppable de grupo.
- `InventoryBoard`: tela principal do inventário, abas, grupos, segmentos, cards, bulk actions e modal de ficha.

`client/src/components/inventory/MachineCard.jsx`

- `statusLabel(status)`: texto do status.
- `statusTone(status)`: tom visual do status.
- `metricTone(value)`: tom de CPU/RAM/disco.
- `DiskIndicator`: indicador de disco.
- `MachineCardContent`: conteúdo visual do card.
- `MachineCard`: wrapper com `useDraggable`.

`client/src/components/inventory/MachineDetailsModal.jsx`

- `DetailItem`: bloco label/valor.
- `formatDate(value)`: data formatada.
- `buildMetricAlert(payload)`: cria alerta por métrica.
- `buildActiveAlerts(machine)`: monta alertas ativos.
- `buildResolvedAlerts(machine, hardware)`: monta alertas resolvidos.
- `normalizeSoftware(software)`: normaliza lista de software.
- `getDiskHealth(hardware)`: calcula saúde de disco.
- `isMaintenanceSegmentName(name)`: detecta manutenção.
- `ErrorAlertList`: lista de alertas.
- `MachineDetailsModal`: ficha completa da máquina.

`client/src/components/inventory/useInventoryDragAndDrop.js`

- `useInventoryDragAndDrop(payload)`: encapsula sensores, handlers e regras de drag-and-drop de máquinas, segmentos e grupos.

`client/src/components/inventory/inventoryUtils.js`

- `normalizeGroupId(groupId)`: normaliza grupo.
- `getSegmentGroupId(segment, groups)`: resolve grupo do segmento.
- `assignSegmentToGroup(groups, segmentId, groupId)`: move segmento de grupo.
- `hasDuplicateSegmentName(segments, payload)`: evita nomes duplicados no mesmo grupo.
- `upsertSegmentList(current, segment)`: insere ou atualiza segmento.
- `moveIdInList(ids, id, direction)`: move item na lista.

### Backend

`server/src/controllers/deviceController.js`

- `validateManualAsset(payload)`: valida ativo manual.
- `list`: lista dispositivos.
- `details`: detalhe autenticado.
- `publicDetails`: detalhe público via QR Code.
- `createManual`: cria ativo manual.
- `updateManual`: edita ativo manual.
- `refreshPing`: atualiza ping de ativo manual.
- `changeDeviceType`: altera tipo de ativo.
- `moveToSegment`: move ativo entre segmentos.
- `changeDeviceBackup`: marca/desmarca backup.
- `removeDevice`: remove ativo.

`server/src/controllers/segmentController.js`

- `list`: lista segmentos.
- `listGroups`: lista grupos.
- `createGroup`: cria grupo.
- `create`: cria segmento.
- `rename`: edita segmento.
- `renameGroup`: edita grupo.
- `removeGroup`: remove grupo.
- `remove`: remove segmento.

`server/src/services/monitoringService.js`

- `normalizeStatus(status)`: normaliza status externo.
- `inferAssetType(host, inventory)`: infere tipo de ativo.
- `backupMetadata(metadata)`: prepara dados de backup.
- `enrichDevice(host, inventory, segment, metadata)`: junta OCS/Zabbix/segmento/metadados.
- `buildManualDevice(asset, segment, metadata)`: converte ativo manual em dispositivo.
- `listDevices(filters)`: lista dispositivos enriquecidos.
- `getDeviceDetails(id)`: detalhe completo.
- `getDashboardSummary()`: resumo do dashboard.

## Alertas e dashboard

`server/src/controllers/alertController.js`

- `active`: lista alertas ativos.
- `history`: lista histórico.
- `acknowledge`: reconhece alerta.
- `removeAcknowledgement`: remove reconhecimento.

`server/src/repositories/alertAcknowledgementRepository.js`

- `listAcknowledgements()`: lista reconhecimentos.
- `findAcknowledgement(alertId)`: busca por alerta.
- `upsertAcknowledgement(payload)`: cria/atualiza.
- `deleteAcknowledgement(alertId)`: remove.
- `attachAcknowledgements(alerts, acknowledgements)`: junta alertas e reconhecimentos.
- `fromRow(row)`: normaliza linha SQL.

## Configurações gerais

`client/src/components/settings/GeneralSettingsModal.jsx`

- `emptyUserForm()`: formulário vazio de usuário.
- `emptySectorForm()`: formulário vazio de setor.
- `formatDateTime(value)`: data/hora.
- `PermissionChecklist`: checklist de permissões.
- `readGeneralPreferences()`: lê preferências visuais.
- `getFontScaleValue(fontScale)`: converte escala.
- `customThemeToVariables(theme)`: converte tema customizado em CSS vars.
- `isDarkThemeActive()`: detecta modo escuro.
- `ensureReadableAppearanceVariables(variables, darkMode)`: garante contraste.
- `clearRuntimeAppearancePreferences()`: limpa CSS vars em login/logout.
- `applyGeneralPreferences(preferences)`: aplica tema/preset/tamanho.
- `applyStoredGeneralPreferences()`: aplica preferências salvas.
- `GeneralSettingsModal`: modal de configurações gerais, Admin, aparência e modo do sistema.

Preferências visuais que permanecem no frontend:

- tema claro/noturno após login;
- preset visual;
- tema customizado;
- tamanho global de fonte;
- accordions e abas abertas.

Configurações de regra que vão ao backend:

- modo Local/Business;
- usuários, setores e permissões;
- configurações de OS;
- status de OS;
- serviços, produtos, técnicos, clientes, tipos de problema e regras de prioridade.

## Cliente HTTP

`client/src/api.js`

- `API_BASE_URL`: base da API local ou `/api` em produção.
- `normalizeBaseUrl(baseUrl)`: remove barra final.
- `buildApiUrl(path)`: monta URL HTTP final.
- `buildWsUrl()`: monta URL WebSocket.
- `apiFetch(path, options)`: wrapper de fetch com JSON, token, erro e expiração de sessão.

Funções exportadas:

- Autenticação: `login`, `register`.
- Dispositivos: `fetchDevices`, `fetchDevice`, `fetchPublicDevice`, `updateDeviceSegment`, `deleteDevice`, `createManualAsset`, `updateManualAsset`, `updateDeviceType`, `updateDeviceBackup`, `refreshAssetPing`.
- Segmentos/grupos: `fetchSegments`, `fetchSegmentGroups`, `createSegment`, `renameSegment`, `deleteSegment`, `createSegmentGroup`, `updateSegmentGroup`, `deleteSegmentGroup`.
- Alertas: `fetchAlerts`, `fetchAlertHistory`, `acknowledgeAlert`, `removeAlertAcknowledgement`.
- Ordens de Serviço: `fetchServiceOrders`, `fetchServiceOrder`, `createServiceOrder`, `updateServiceOrder`, `updateServiceOrderStatus`, `addServiceOrderHistory`, `deleteServiceOrder`.
- Configurações: `fetchSystemSettings`, `updateSystemSettings`, `fetchServiceOrderSettings`, `updateServiceOrderSettings`, `fetchServiceOrderStatuses`, `createServiceOrderStatus`, `updateServiceOrderStatusDefinition`, `deleteServiceOrderStatus`.
- Usuários e permissões: `fetchUsers`, `fetchPermissions`, `createUser`, `updateUserAccess`, `updateUserPermissions`, `deleteUser`, `updateUserRole`.
- Setores: `fetchSectors`, `createSector`, `updateSector`, `updateSectorPermissions`, `deleteSector`.
- Público: `fetchPublicSupportOptions`, `createPublicServiceOrder`.
- Cadastros da OS: `fetchClients`, `createClient`, `updateClient`, `deleteClient`, `importClients`, `fetchProducts`, `createProduct`, `updateProduct`, `deleteProduct`, `importProducts`, `fetchServices`, `createService`, `updateService`, `deleteService`, `fetchTechnicians`, `createTechnician`, `updateTechnician`, `deleteTechnician`, `fetchProblemTypes`, `createProblemType`, `updateProblemType`, `deleteProblemType`, `fetchPriorityRules`, `createPriorityRule`, `updatePriorityRule`, `deletePriorityRule`.

## Logs e histórico

`server/src/repositories/logRepository.js`

- `addLog(payload)`: registra evento administrativo.
- `listLogs()`: lista logs.
- `fromRow(row)`: normaliza linha SQL.

`server/src/repositories/assetHistoryRepository.js`

- `addAssetHistory(payload)`: registra histórico de ativo.
- `listAssetHistory(assetId)`: lista histórico do ativo.
- `fromRow(row)`: normaliza linha.

`service_order_history` registra eventos da OS. Quando um evento manual tem ativo vinculado, o controller também replica em `asset_history`.

## Integrações mockadas e futuras

`server/src/services/ocsService.js`

- `getInventory()`: lista inventário mockado.
- `getInventoryByHostId(id)`: busca host mockado.

`server/src/services/zabbixService.js`

- `getHosts()`: lista hosts mockados.
- `getHostById(id)`: busca host.
- `getActiveAlerts()`: lista alertas ativos.
- `getAlertHistory()`: lista histórico.
- `getHostAlerts(hostId)`: lista alertas por host.

`server/src/services/pingStatusService.js`

- `checkPingStatus(asset)`: simula ping para ativo manual.

`server/src/integrations/ping/PingService.js`

- `hashIp(ip)`: gera valor determinístico simples.
- `PingService.check(asset)`: adaptador preparado para ping real futuro.

`server/src/integrations/ocs/OcsInventoryService.js`

- `OcsInventoryService`: adaptador preparado para OCS real.

`server/src/integrations/zabbix/ZabbixService.js`

- `ZabbixService`: adaptador preparado para Zabbix real.

## Persistência local no frontend

Ainda existem chaves locais para preferências e estado visual:

- `it_guardian_token`
- `it_guardian_user`
- `it_guardian_theme`
- `it_guardian_general_preferences`
- `it_guardian_machine_aliases`
- `it_guardian_machine_observations`
- `it_guardian_removed_peripherals`
- `it_guardian_peripheral_history`
- `it_guardian_active_inventory_tab`

Essas chaves não devem virar fonte de verdade de regra crítica. O backend deve continuar sendo a fonte para usuários, permissões, OS, setores, configurações e cadastros.

## Fluxos principais

### Login

1. Usuário envia e-mail e senha pelo frontend.
2. `client/src/api.js` chama `POST /api/auth/login`.
3. `authController.login` busca usuário e compara `bcrypt`.
4. Backend retorna usuário público e JWT.
5. Frontend salva sessão e carrega dados autenticados.

### Criação de OS

1. Técnico abre modal de criação.
2. Frontend monta payload sem gerar número final.
3. `POST /api/service-orders` valida permissão `service_orders.create`.
4. Backend gera número, status inicial, prioridade e histórico.
5. Frontend atualiza lista com a OS retornada.

### Atendimento de OS

1. Usuário abre detalhe da OS.
2. Aba Atendimento permite diagnóstico, serviço, peças e notas.
3. Em modo Local, valores financeiros ficam ocultos.
4. Em modo Business, valores de serviço/peças são exibidos.
5. `PATCH /api/service-orders/:id` persiste dados e histórico.

### Inventário

1. Frontend carrega dispositivos, segmentos e grupos.
2. Cards são agrupados por segmento.
3. Drag-and-drop chama API de movimentação.
4. Ficha da máquina exibe hardware, software, histórico, periféricos e QR Code.

### Configurações

1. Configurações Gerais tratam aparência, Admin e modo do sistema.
2. Configurações da OS tratam status, numeração, prioridade e cadastros.
3. Backend bloqueia alterações por permissão.

## Limites conhecidos

- OCS, Zabbix e ping real ainda são adaptadores mockados.
- Algumas preferências visuais continuam no `localStorage`.
- Inventário ainda tem partes de organização visual locais.
- Monitoramento contínuo real depende de VPS, agente ou coletor dentro da rede.

## Convenções de manutenção

- Não alterar rotas, chaves internas ou nomes de tabelas sem migração planejada.
- Toda regra crítica deve ser validada no backend.
- Frontend pode esconder botões, mas backend sempre deve bloquear API sem permissão.
- Textos visíveis devem ficar em PT-BR profissional.
- Preferências visuais podem ficar no frontend; regras de negócio devem persistir no backend.

## Checklist de leitura para novos desenvolvedores

1. Leia `README.md`.
2. Leia `docs/FASE-1-INVENTARIO.md`.
3. Leia `docs/FASE-2-ORDENS-SERVICO.md`.
4. Leia este documento.
5. Abra `server/src/app.js` para entender rotas.
6. Abra `client/src/App.jsx` para entender estado geral.
7. Abra `client/src/api.js` para entender chamadas HTTP.
8. Abra `server/src/repositories/serviceOrderRepository.js` para entender a regra central de OS.
