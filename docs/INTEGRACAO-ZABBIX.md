# Integracao Zabbix

## Instalacao do agente Windows

O instalador do IT Guardian inclui o Zabbix Agent 2 7.0.29 oficial. Os campos
`Server` e `ServerActive` sao vinculados a chave pelo administrador e
devolvidos automaticamente durante a ativacao. O hostname usado pelo agente e
o nome real do computador Windows. O servico fica automatico.

O host correspondente ainda precisa existir no servidor/proxy Zabbix. O
adaptador de leitura do backend continua precisando de `ZABBIX_API_URL` e
`ZABBIX_API_TOKEN` para consultar a API central.

## Objetivo

O Zabbix e uma fonte opcional de monitoramento. O IT Guardian consulta hosts e problemas,
normaliza os resultados e persiste um snapshot local. Nenhuma acao de escrita e executada
contra a API Zabbix.

A integracao:

- aceita somente os modos `real` e `disabled`;
- fica desabilitada por padrao;
- usa token de API;
- consulta hosts, disponibilidade e problemas;
- nao cria hosts, nao altera triggers/templates e nao coloca hosts em manutencao;
- nao e necessaria para o Agent nem para o funcionamento local.

## Configuracao

```env
ZABBIX_MODE=real
ZABBIX_ENABLED=true
ZABBIX_API_URL=http://zabbix.internal/api_jsonrpc.php
ZABBIX_API_TOKEN=troque-por-um-token-somente-leitura
ZABBIX_TIMEOUT_MS=10000
ZABBIX_RETRIES=1
ZABBIX_SYNC_INTERVAL_MINUTES=5
INTEGRATION_STORE_RAW_DATA=false
```

O token nunca e retornado na configuracao publica nem inserido em mensagens de erro. Em um
servidor Node persistente, `ZABBIX_SYNC_INTERVAL_MINUTES` controla a sincronizacao automatica
e a primeira consulta ocorre na inicializacao. A sincronizacao manual continua disponivel.

Modos:

- `real`: consulta JSON-RPC quando `ZABBIX_ENABLED=true`;
- `disabled`: nao acessa a rede.

Qualquer valor legado, inclusive `mock`, e tratado como `disabled`. Sem conexao real, a
integracao retorna uma lista vazia em vez de exibir hosts ou alertas ficticios.

## Endpoints administrativos

Todos exigem sessao autenticada com permissao de administrador:

- `GET /api/integrations/zabbix/status`
- `POST /api/integrations/zabbix/test`
- `POST /api/integrations/zabbix/sync`
- `GET /api/integrations/zabbix/problems`
- `GET /api/integrations/zabbix/last-sync`

`GET /api/integrations/zabbix/problems?status=active` filtra o snapshot persistido.

## Consultas realizadas

- `host.get`: identidade, interfaces, disponibilidade e inventario basico;
- `problem.get`: problemas recentes;
- `trigger.get`: resolve a relacao entre problema e host.

Nao ha chamadas de escrita. Metricas detalhadas via `item.get` nao foram adicionadas nesta
etapa; o modelo normalizado aceita metricas quando elas estiverem disponiveis.

## Dados normalizados

- identificador externo, hostname, nome e IP;
- disponibilidade operacional;
- inventario basico informado pelo host;
- problema, severidade, estado e datas;
- relacao do problema com host;
- data da coleta.

Alertas/problemas preferem Zabbix. Status pode ser combinado com Agent. Localizacao, grupo e
segmento continuam manuais no IT Guardian.

## Correlacao

O host e correlacionado por:

1. `source + externalId`;
2. hostname normalizado;
3. IP;
4. numero de serie.

Conflitos sao persistidos para revisao e nunca provocam fusao automatica.

## Falhas e limitacoes

- O token precisa de permissoes para `host.get`, `problem.get` e `trigger.get`.
- Jobs continuos nao rodam dentro de funcoes serverless da Vercel. Execute a API local,
  em Docker ou em uma VPS com acesso ao Zabbix para obter sincronizacao periodica.
- Nao ha leitura de historico completo ou `item.get` nesta etapa.
- Quando o Zabbix falha, o sistema mostra erro seguro e mantem o ultimo snapshot.

## Teste em ambiente real

1. Crie um token de API somente leitura.
2. Configure as variaveis em uma maquina com acesso ao Zabbix.
3. Reinicie a API.
4. Autentique-se como administrador.
5. Execute `POST /api/integrations/zabbix/test`.
6. Execute `POST /api/integrations/zabbix/sync`.
7. Consulte `/api/integrations/zabbix/problems`.
8. Verifique origem, ultima coleta e conflitos no inventario.
9. Revogue temporariamente o token e confirme a mensagem amigavel sem vazamento.
