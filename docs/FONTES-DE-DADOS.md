# Fontes de dados do inventario

## Origens suportadas

O inventario aceita simultaneamente:

| Origem | Papel principal | Obrigatoria |
| --- | --- | --- |
| `manual` | Localizacao, cadastro e ativos sem agente | Nao |
| `agent` | Coleta local e heartbeat da maquina | Nao |
| `ocs` | Inventario de hardware e software | Nao |
| `zabbix` | Disponibilidade e problemas | Nao |
| `mock` | Demonstracao e desenvolvimento | Nao |

O sistema funciona com qualquer subconjunto dessas origens. OCS e Zabbix desabilitados
produzem listas vazias sem chamadas externas.

## Modelo normalizado

Cada adaptador converte sua resposta para estruturas comuns antes da persistencia:

- ativo: origem, identificador externo, hostname, nome, IP, serial, MAC, fabricante,
  modelo, sistema operacional, status, metricas, hardware e data de coleta;
- alerta: origem, identificador externo, ativo relacionado, titulo, severidade, estado e
  datas;
- dados brutos: opcionais e desabilitados por padrao.

Snapshots OCS/Zabbix ficam em:

- `integration_assets`;
- `integration_alerts`;
- `integration_sync_state`;
- `integration_conflicts`.

Uma sincronizacao salva ativos, alertas, conflitos e estado dentro de uma unica transacao.

## Prioridade e composicao

- campos cadastrados manualmente nao sao sobrescritos sem confirmacao;
- grupo, segmento e localizacao pertencem ao IT Guardian;
- hardware pode vir de OCS ou Agent;
- status pode vir de Zabbix ou Agent;
- alertas e problemas preferem Zabbix;
- o ultimo snapshot continua disponivel durante falhas externas.

O detalhe da maquina mostra todas as origens associadas, a ultima coleta de cada origem e
conflitos pendentes. Uma maquina presente apenas no OCS tambem aparece no inventario.

## Correlacao segura

A correlacao usa:

1. `source + externalId`;
2. hostname em minusculas e sem ponto final;
3. IP normalizado;
4. numero de serie normalizado.

Uma evidencia ambigua ou identificadores que apontem para mais de um ativo geram registro em
`integration_conflicts`. Nao existe mesclagem automatica em caso de conflito.

## Seguranca

- credenciais e tokens ficam em variaveis de ambiente;
- endpoints de integracao exigem administrador;
- configuracoes retornadas nao incluem segredos;
- timeouts e retries sao limitados;
- erros externos sao amigaveis e nao incluem credenciais;
- adaptadores OCS/Zabbix sao somente leitura;
- payload bruto exige ativacao explicita.

## Operacao recomendada

1. Mantenha `mock` durante demonstracoes ou `disabled` em instalacoes sem integracao.
2. Valide a conectividade com o endpoint `test`.
3. Execute a primeira sincronizacao manual.
4. Revise conflitos antes de confiar na composicao de fontes.
5. Monitore `last-sync` e preserve credenciais fora do repositorio.
6. Adicione jobs somente depois de validar volume, timeout e limites das APIs reais.
