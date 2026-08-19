# Prontuario Tecnico do Ativo (Timeline)

## Objetivo

O Prontuario Tecnico e uma nova aba na ficha da maquina do Inventario
(`MachineDetailsModal`) que consolida, em ordem cronologica, o historico
tecnico real de um ativo: ordens de servico, alertas, entrada/saida de
manutencao, preventivas, assistencia remota, observacoes e vinculo com o
Mapa de Rede. Nao e um modulo novo de dados - e uma camada de leitura que
consolida informacao que ja existia espalhada em varias tabelas/subsistemas
do sistema, sem reconstruir nenhum deles.

**Nenhum evento e inventado.** Se uma fonte nao tem dado real (ex.: data de
criacao do ativo, historico de hardware), o Prontuario simplesmente nao
mostra esse evento - nunca preenche com um valor fabricado.

## Onde fica

Ficha da maquina, no Inventario: a aba que antes se chamava "Historico" foi
renomeada para **"Prontuario Tecnico"** e passou a mostrar a timeline real,
no lugar do bloco anterior (que na pratica nao mostrava nada de real - lia
`machine.assetHistory`, que no fluxo do Inventario e so uma lista
client-local de trocas de periferico, nunca as linhas reais do banco).

Carregada sob demanda: a chamada ao backend so acontece quando a aba e
aberta, nao quando a ficha da maquina abre.

## Fontes de eventos

| Categoria | Fonte | Observacao |
|---|---|---|
| `service_order` / `part` | `service_orders`, `service_order_items` (consulta dedicada por `asset_id`) | Abertura, fechamento, pecas registradas, SLA vencido (`service_order_sla_breached`), reabertura (`service_order_reopened`) e avaliacao recebida (`service_order_feedback_submitted`) - lidos direto dos campos ja retornados por `listServiceOrdersByAssetId` (`slaBreachedAt`, `reopenedAt`, `feedback`), sem gravar em `asset_history`. |
| `alert` | `alertService.getHostAlertsWithAcknowledgements` (ja existia) | Criacao, reconhecimento e resolucao. |
| `remote_assistance` | `remote_assistance_events` (consulta dedicada por `asset_id`) | So aparece para quem tem `remote_assistance.view` - ver "Permissoes". |
| `topology` | `network_topology_nodes`/`_links` (vinculo atual) + `asset_history` (eventos daqui pra frente) | Ver secao propria abaixo. |
| `preventive`, `maintenance`, `segment`, `hardware`, `system` | `asset_history` (tabela generica ja usada por varios modulos) | Backbone: cobre tudo que ja era gravado antes desta rodada. |
| `observation` | Prop `observations` (preferencia do usuario logado) | Fundido no **cliente**, nao vem do backend - ver "Limitacoes". |
| `asset` | `manual_network_assets`/`agent_assets` (melhor esforco) | So aparece se houver `createdAt` real. |

### Por que nao existe uma unica query "todos os eventos do ativo"

`asset_history` (`server/src/repositories/assetHistoryRepository.js`) ja e
escrita por ~15 arquivos diferentes do sistema, mas guarda so
`event_type`/`message`/`old_value`/`new_value` - sem referencia estruturada
a entidade relacionada (numero da OS, prioridade, tecnico, severidade do
alerta). Para os cartoes ricos pedidos ("OS #123 aberta - Prioridade: Alta |
Tecnico: Joao"), o service busca OS e alertas nas proprias tabelas
estruturadas, e usa `asset_history` como complemento generico para tudo que
nao tem uma fonte mais rica (segmento, manutencao, backup, preventivas,
CRUD de ativo manual, vinculo com Plantas/Mapa Visual 3D). Para nao
duplicar o mesmo evento em duas fontes diferentes, os prefixos
`service_order_*` e `remote_assistance_*` sao explicitamente excluidos do
backbone generico (`assetTimelineService.js`, `BACKBONE_EXCLUDED_PREFIXES`).

## Mapa de Rede no Prontuario

Duas pecas complementares:

1. **Vinculo atual**: um bloco de resumo mostra "Este ativo aparece em N
   mapa(s) de rede", com o nome de cada mapa - consulta direta em
   `network_topology_nodes`/`network_topology_links` (nao depende de
   evento historico, entao cobre vinculos criados antes desta rodada).
2. **Historico daqui pra frente**: `networkTopologyRepository.js` passa a
   gravar em `asset_history` quando um no/conexao envolvendo o ativo e
   criado ou removido (`network_topology_node_added/removed`,
   `network_topology_link_created/removed`) - mesmo padrao ja usado por OS
   (`addServiceOrderAssetHistory`). Eventos anteriores a esta rodada nao
   sao reconstruidos.

Texto obrigatorio sempre presente no bloco: "Conexões do Mapa de Rede
representam relação cadastrada manualmente e não medição real do enlace."

## Endpoint

`GET /api/devices/:id/timeline?category=&period=&limit=&offset=&onlyImportant=`

Permissao: `inventory.view_machine` (a mesma que ja abre a ficha da
maquina - nenhuma permissao nova). Resposta:

```json
{
  "assetId": "...",
  "events": [],
  "summary": {
    "totalEvents": 0,
    "serviceOrdersOpened": 0,
    "serviceOrdersClosed": 0,
    "alerts": 0,
    "criticalAlerts": 0,
    "remoteSessions": 0,
    "preventives": 0,
    "hardwareChanges": 0,
    "lastMaintenanceAt": null,
    "networkTopologyMapCount": 0,
    "lastEventAt": null
  },
  "topologyReferences": { "mapCount": 0, "maps": [], "links": [] },
  "filters": { "availableCategories": [] },
  "metadata": { "generatedAt": "...", "limit": 50, "offset": 0, "total": 0 }
}
```

Categorias: `asset`, `status`, `segment`, `maintenance`, `service_order`,
`alert`, `preventive`, `remote_assistance`, `observation`, `hardware`,
`part`, `topology`, `system`. Periodos: `7d`, `30d`, `90d`, `1y`, `all`.

## Permissoes e privacidade

- Ver a aba inteira exige `inventory.view_machine` (igual a ficha da
  maquina hoje).
- A categoria `remote_assistance` exige adicionalmente
  `remote_assistance.view` - sem essa permissao, a categoria **some
  inteira da resposta** (nao e so escondida no frontend, o backend nao
  inclui os eventos). O papel `operator` tem `inventory.view_machine` por
  padrao mas nao tem nenhuma permissao de `remote_assistance.*` -
  confirmado por teste de integracao dedicado.
- Os eventos de `remote_assistance_events` ja eram, antes desta rodada,
  livres de token/frame/comando remoto/conteudo de chat - confirmado na
  auditoria do schema (`remote_assistance_events` so guarda
  `event_type`/`message`/`metadata` com campos escalares como
  `requestedMode`/`reason`/`monitorId`). O Prontuario nao adiciona nenhum
  campo sensivel novo.

### Achado de seguranca pre-existente (relatado, nao corrigido nesta rodada)

`monitoringService.getDeviceDetails()` (usado pelo fluxo do Dashboard, nao
pelo Inventario) ja retorna `assetHistory` **sem nenhum filtro de
permissao de assistencia remota** - isso inclui as linhas
`remote_assistance_*` que ja existiam em `asset_history` antes desta
rodada. Na pratica isso nunca apareceu porque a aba "Historico" antiga do
Inventario nao lia esse campo. O Prontuario Tecnico **corrige isso apenas
no seu proprio endpoint** (gate de `remote_assistance.view` descrito
acima); `getDeviceDetails`/Dashboard nao foram alterados nesta rodada
(fora do escopo pedido, e mudar esse fluxo mudaria comportamento de uma
tela que ja funciona). Recomenda-se um follow-up dedicado se o mesmo gate
for desejado la tambem.

## Limitacoes conhecidas

- **Transicoes de status (online/offline/problem) nao aparecem.** O status
  e calculado ao vivo a cada leitura (`monitoringService.js`), nunca
  persistido - implementar isso exigiria instrumentar o loop de
  polling do Zabbix/OCS, fora do escopo desta rodada. Entrada/saida de
  manutencao (mover o ativo pro segmento de manutencao) ja funciona e
  cobre a parte mais usada na pratica.
- **Alteracoes de hardware nao aparecem.** Confirmado que
  `hardware.changeHistory` e sempre `[]` em `monitoringService.js` - nunca
  existiu captura real de diff de hardware no sistema. A categoria
  `hardware` existe no modelo/filtros do frontend, preparada para quando
  essa captura existir.
- **Observacoes nao vem do backend do Prontuario.** `observations[assetId]`
  e preferencia do usuario logado (`useInventoryPersistence.js`,
  sincronizada via `saveUserPreference`), nao uma tabela por ativo
  consultavel de forma independente do usuario. O componente funde essas
  observacoes no cliente com os eventos vindos do backend - criar uma
  tabela dedicada so pra isso nao foi pedido e mudaria uma area que ja
  funciona.
- **Sem link de navegacao para abrir a OS/alerta em outro modulo.** O app
  nao tem hoje um mecanismo de "abrir item especifico" entre
  Inventario/OS/Alertas (so navegacao por modulo, ex.
  `setActiveView("service-orders")`). Os cartoes de OS/alerta mostram os
  dados (numero, prioridade, severidade) como texto informativo, sem link
  clicavel. O vinculo com o **Mapa de Rede** e a excecao: como e outra aba
  do mesmo `InventoryBoard`, o botao "Abrir mapa" funciona de verdade
  (troca a visualizacao do Inventario para "Mapa de Rede").
- **Data de criacao do ativo nem sempre aparece.** So e mostrada quando o
  registro manual/do agente tem um `createdAt` real; nunca e inventada.

## Como testar manualmente

1. `DATABASE_URL=memory ENABLE_DEMO_SEED=true` no server (porta 4000) +
   client Vite (porta 5173); login `admin@itguardian.local`/`123456`.
2. Inventario → abrir a ficha de uma maquina com OS/alerta/preventiva
   reais → aba "Prontuario Tecnico".
3. Testar filtros de categoria/periodo/busca e o botao "Carregar mais".
4. Adicionar o ativo a um Mapa de Rede e confirmar que o bloco de resumo
   aparece com o link "Abrir mapa".
5. Confirmar que um usuario sem `remote_assistance.view` nao ve a
   categoria de assistencia remota.

## Proximos passos

- Persistir transicoes de status relevantes (online→offline etc.).
- Capturar e persistir diffs reais de hardware.
- Mecanismo generico de deep-link entre Inventario/OS/Alertas para os
  cartoes da timeline abrirem o item relacionado diretamente.
- Avaliar aplicar o mesmo gate de `remote_assistance.view` em
  `monitoringService.getDeviceDetails()`/fluxo do Dashboard.
