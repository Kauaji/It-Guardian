# Decisao OCS, Zabbix e coletor nativo na beta

## Decisao

Para a beta, o coletor nativo do IT Guardian e o unico componente obrigatorio
no computador Windows. OCS Inventory e Zabbix foram mantidos somente como
adaptadores avancados, opcionais, de leitura e desabilitados por padrao no
backend.

O instalador comum:

- solicita apenas a chave de produto;
- ativa o computador pela API;
- instala somente o coletor nativo;
- registra a tarefa SYSTEM, a bandeja e o atalho de abertura de chamado;
- nao baixa nem instala agentes OCS ou Zabbix;
- nao depende de Radmin, VPN ou servidor local improvisado.

## Motivo

Essa combinacao reduz tamanho, pontos de falha, superficie de ataque e
complexidade operacional. Ao mesmo tempo, preserva os conectores existentes
para empresas que ja operam servidores OCS ou Zabbix e desejem sincronizacao
somente leitura em uma implantacao avancada.

## Cobertura do coletor nativo

O coletor envia por HTTPS autenticado:

- identificador estavel da maquina, hostname e alias;
- Windows, versao e arquitetura;
- IP e MAC da interface ativa;
- fabricante, modelo e numero de serie;
- modelo e uso de CPU;
- memoria total, usada e livre;
- disco do sistema total e livre;
- uptime, usuario logado quando permitido, versao e horario da coleta;
- heartbeat usado para disponibilidade.

Esses dados alimentam o inventario, os detalhes da maquina, o mapa, o historico
e os alertas de indisponibilidade, CPU, memoria, disco alto e disco praticamente
cheio.

## Recursos deliberadamente adiados

- inventario completo de softwares: exige politica de volume e privacidade;
- temperatura: o Windows nao oferece uma fonte universal e confiavel;
- metricas historicas densas: exigem retencao e agregacao proprias;
- atualizacao automatica do coletor: exige assinatura e cadeia de distribuicao.

Essas ausencias nao tornam OCS ou Zabbix obrigatorios para a beta.

## Integracoes opcionais

OCS e Zabbix podem ser habilitados no processo persistente do backend por
variaveis de ambiente. Eles consultam APIs centrais existentes, somente em
leitura, e persistem snapshots. Nao fazem parte do instalador do endpoint e nao
devem bloquear ativacao, inventario, alertas, historico ou abertura de chamado.
