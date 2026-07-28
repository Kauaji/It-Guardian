# Integracao OCS Inventory

## Instalacao do agente Windows

O instalador do IT Guardian inclui o OCS Inventory Agent 2.11.0.1 oficial. A
URL de comunicacao, normalmente terminada em `/ocsinventory`, e vinculada a
chave pelo administrador e devolvida automaticamente durante a ativacao. O
agente e instalado como servico automatico e envia o primeiro inventario ao
servidor configurado.

Isso nao substitui o OCS Communication Server. O adaptador de leitura do
backend continua precisando de `OCS_BASE_URL`, `OCS_USER` e `OCS_PASSWORD` para
consultar a API central em um processo com acesso a rede.

## Objetivo

O OCS Inventory e uma fonte opcional de inventario de hardware e software. O IT Guardian
consulta computadores, normaliza os dados e persiste um snapshot local. A navegacao do
inventario usa esse snapshot e nao depende de uma chamada ao OCS em cada abertura de tela.

A integracao:

- aceita somente os modos `real` e `disabled`;
- fica desabilitada por padrao em instalacoes locais;
- opera somente em leitura;
- nao altera computadores, agentes ou configuracoes no OCS;
- nao e obrigatoria para o Agent, ativos manuais ou o restante do sistema.

## Configuracao

```env
OCS_MODE=real
OCS_ENABLED=true
OCS_BASE_URL=http://ocs.internal/ocsapi/v1
OCS_USER=integration-reader
OCS_PASSWORD=troque-por-uma-senha-segura
OCS_COMPUTERS_PATH=/computers
OCS_TIMEOUT_MS=10000
OCS_RETRIES=1
OCS_SYNC_INTERVAL_MINUTES=60
INTEGRATION_STORE_RAW_DATA=false
```

Use uma conta dedicada e somente leitura. Credenciais ficam apenas no ambiente e nunca sao
devolvidas por endpoints de status. Em um servidor Node persistente,
`OCS_SYNC_INTERVAL_MINUTES` controla a sincronizacao automatica e a primeira consulta ocorre
na inicializacao. A sincronizacao manual continua disponivel.

Modos:

- `real`: usa a API configurada, desde que `OCS_ENABLED=true`;
- `disabled`: retorna uma lista vazia sem acessar a rede.

Qualquer valor legado, inclusive `mock`, e tratado como `disabled`. O IT Guardian nunca
inventa computadores quando o OCS esta ausente ou mal configurado.

## Endpoints administrativos

Todos exigem sessao autenticada com permissao de administrador:

- `GET /api/integrations/ocs/status`
- `POST /api/integrations/ocs/test`
- `POST /api/integrations/ocs/sync`
- `GET /api/integrations/ocs/last-sync`

O teste de conexao nao persiste inventario. A sincronizacao normaliza e salva o snapshot,
a quantidade importada, a data, o estado e um erro amigavel quando houver falha.

## Dados coletados

Quando disponiveis na resposta do OCS:

- identificador externo e hostname;
- IP e MAC;
- fabricante, modelo, serial e patrimonio;
- sistema operacional;
- CPU, memoria, discos, software, perifericos e usuario logado;
- data da ultima coleta.

O payload bruto nao e armazenado por padrao. Para diagnostico controlado, use
`INTEGRATION_STORE_RAW_DATA=true` e proteja o banco de acordo com a politica da empresa.

## Correlacao

A correlacao procura, nesta ordem:

1. `source + externalId`;
2. hostname normalizado;
3. IP;
4. numero de serie.

Identificadores que apontem para ativos diferentes geram uma pendencia. O sistema nao mescla
o conflito automaticamente. Localizacao, grupo e segmento continuam sob controle do
IT Guardian, e dados manuais nao sao sobrescritos pelo OCS.

## Falhas e limitacoes

- O formato da API OCS varia por versao e plugin; ajuste `OCS_COMPUTERS_PATH` quando preciso.
- Jobs continuos nao rodam dentro de funcoes serverless da Vercel. Execute a API local,
  em Docker ou em uma VPS com acesso ao OCS para obter sincronizacao periodica.
- Nao ha formulario para gravar credenciais pela interface; use variaveis de ambiente.
- O sistema continua funcional com OCS indisponivel e preserva o ultimo snapshot valido.

## Teste em ambiente real

1. Crie uma conta OCS somente leitura.
2. Configure as variaveis em uma maquina que alcance a rede do OCS.
3. Reinicie a API.
4. Autentique-se como administrador.
5. Execute `POST /api/integrations/ocs/test`.
6. Execute `POST /api/integrations/ocs/sync`.
7. Verifique status, ultima sincronizacao e origens no detalhe do inventario.
8. Simule indisponibilidade e confirme que o inventario local continua acessivel.
