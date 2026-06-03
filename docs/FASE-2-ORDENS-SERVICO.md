# Fase 2 - Ordens de Servico

Este documento registra a primeira base do modulo de Ordens de Servico do IT Guardian.

## Objetivo

Adicionar controle de atendimentos tecnicos ao sistema sem quebrar a Fase 1 de Inventario. Nesta etapa, o modulo nasce simples: cria, lista, edita e acompanha ordens vinculadas aos ativos.

## Escopo implementado

- nova tela `Ordens de Servico` na sidebar principal;
- kanban/listagem por status;
- criacao manual de OS;
- detalhe em modal grande;
- abas internas: Geral, Atendimento, Maquina e Historico;
- vinculo opcional com maquina/ativo existente;
- vinculo com ambiente/cliente;
- campos simples para solicitante e tecnico responsavel;
- registro de diagnostico, atendimento, solucao e pecas trocadas;
- historico automatico de criacao, mudanca de status, tecnico, prioridade e atendimento;
- regra de negocio: uma OS so avanca de `Aberta` se tiver tecnico responsavel;
- criacao automatica de OS aberta quando uma maquina entra em `Manutencao`;
- ao finalizar uma OS de manutencao, a maquina sai da manutencao e volta ao segmento de origem quando ele ainda existe;
- area de Configuracoes com Clientes, Produtos e Tecnicos;
- cadastro de Servicos com codigo obrigatorio no padrao `SRV-0001`;
- Tipos de Problema e Regras de Prioridade;
- importacao CSV basica para Clientes e Produtos;
- tela publica isolada `/abrir-chamado` para abertura de chamado pelo usuario final;
- endpoint publico limitado para criar OS sem expor dados administrativos;
- persistencia em PostgreSQL.

## Status iniciais

| Status interno | Nome na interface | Regra |
| --- | --- | --- |
| `open` | Aberta | status inicial de toda OS |
| `in_progress` | Em atendimento | exige tecnico responsavel |
| `waiting` | Aguardando | exige tecnico responsavel |
| `closed` | Finalizada | exige tecnico responsavel e registra encerramento |

## Prioridades

- `low`: Baixa
- `medium`: Media
- `high`: Alta
- `critical`: Critica

## Modos de uso

O IT Guardian possui a configuracao global `systemMode`, acessivel em Configuracoes Gerais:

- `local`: Local / Uso interno;
- `business`: Business.

O sistema continua sendo uma unica aplicacao. A diferenca principal nesta fase esta no fluxo de Ordens de Servico.

### Local / Uso interno

Indicado para uma empresa cuidar dos proprios equipamentos. A abertura de OS prioriza rapidez e exige apenas o essencial:

- titulo;
- descricao/observacoes;
- categoria;
- setor;
- servico;
- solicitante;
- maquina/ativo quando for possivel identificar.

Campos comerciais, cliente, CNPJ e contrato nao sao obrigatorios neste modo. As abas do inventario podem representar setores, filiais ou ambientes internos.

### Business

Indicado para uma prestadora de TI atender varios clientes. A OS passa a exigir um cadastro mais completo:

- cliente/ambiente;
- maquina/ativo;
- solicitante;
- categoria;
- descricao da solicitacao;
- tecnico responsavel para avancar status;
- prioridade calculada/sugerida pelas configuracoes.

Neste modo, cadastros de clientes, tecnicos, produtos/pecas, servicos, tipos de problema e regras de prioridade ganham mais importancia. A interface usa o rotulo `Cliente` em destaque, enquanto o fluxo local destaca `Setor`.

Administradores podem configurar clientes permitidos por tecnico. Quando um usuario tecnico estiver vinculado ao cadastro de tecnico por nome ou e-mail, a API limita a listagem de OS aos clientes permitidos, exceto para administradores ou usuarios com permissao de visualizacao global.

## Servicos

Servicos representam procedimentos padronizados, sem relacao com financeiro nesta etapa.

Campos:

- codigo obrigatorio, gerado automaticamente como `SRV-0001` quando o administrador nao informa;
- nome;
- descricao;
- categoria;
- prioridade padrao opcional;
- status ativo/inativo.

Exemplos de servico:

- `SRV-0001` - Diagnostico tecnico;
- `SRV-0002` - Formatacao e reinstalacao;
- `SRV-0003` - Troca de peca;
- `SRV-0004` - Correcao de rede;
- `SRV-0005` - Manutencao de impressora.

A criacao de OS pode vincular um servico ativo. A prioridade inicial pode usar a prioridade padrao do servico e tambem regras configuradas por setor, cliente, tipo de problema, servico, categoria ou tempo de abertura.

### Arquitetura futura recomendada para Business

Para clientes diferentes, a arquitetura recomendada nao e depender de uma VPN geral entre todas as redes. O desenho futuro mais seguro e:

```txt
Cliente possui coletor local/agente interno
-> coletor acessa maquinas e servicos da rede interna
-> coletor envia dados para o IT Guardian central
```

Esse modelo reduz exposicao entre clientes, evita dependencia de VPN estilo Hamachi e permite que OCS, Zabbix, ping real e jobs de coleta fiquem dentro da rede correta.

## Backend

Tabelas:

- `service_orders`
- `service_order_history`

Rotas autenticadas:

- `GET /api/service-orders`
- `GET /api/service-orders/:id`
- `POST /api/service-orders`
- `PATCH /api/service-orders/:id`
- `PATCH /api/service-orders/:id/status`
- `POST /api/service-orders/:id/history`
- `GET /api/clients`
- `POST /api/clients`
- `PATCH /api/clients/:id`
- `DELETE /api/clients/:id`
- `POST /api/clients/import`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `POST /api/products/import`
- `GET /api/technicians`
- `POST /api/technicians`
- `PATCH /api/technicians/:id`
- `DELETE /api/technicians/:id`
- `GET /api/services`
- `POST /api/services`
- `PATCH /api/services/:id`
- `DELETE /api/services/:id`
- `GET /api/problem-types`
- `POST /api/problem-types`
- `PATCH /api/problem-types/:id`
- `DELETE /api/problem-types/:id`
- `GET /api/priority-rules`
- `POST /api/priority-rules`
- `PATCH /api/priority-rules/:id`
- `DELETE /api/priority-rules/:id`

Rotas publicas limitadas:

- `GET /api/public/support-options`
- `POST /api/public/service-orders`

Campos simplificados foram escolhidos para manter a Fase 2 evolutiva:

- `requester_name`
- `assigned_technician_name`
- `environment_name`
- `service_id`
- `service_code`
- `service_name`

No futuro, esses campos podem virar relacionamentos com clientes, usuarios tecnicos e ambientes reais.

## Configuracoes

A tela `Configuracoes` cria os cadastros base que serao usados nas proximas evolucoes das Ordens de Servico.

Cadastros iniciais:

- Clientes: nome fantasia, razao social, CNPJ, telefone, e-mail, endereco, responsavel, observacoes e status.
- Produtos/Pecas: nome, categoria, marca, modelo, codigo interno, patrimonio, quantidade, unidade, observacoes e status.
- Tecnicos: nome, e-mail, telefone, cargo/funcao, especialidade, clientes permitidos no modo Business, observacoes e status.
- Servicos: codigo, nome, descricao, categoria, prioridade padrao e status.
- Tipos de Problema: nome, descricao, categoria associada, prioridade padrao e status.
- Regras de Prioridade: tipo da regra, alvo, prioridade sugerida, horas limite, observacoes e status.

Importacao:

- Clientes e Produtos aceitam CSV nesta primeira etapa.
- Arquivos Excel `.xlsx` ficam preparados visualmente para uma etapa futura, mas ainda nao sao processados.
- O importador ignora duplicacoes simples por documento/nome ou codigo/nome e retorna os erros por linha.

As regras de prioridade ainda sao uma base configuravel. A abertura de OS pode considerar setor, cliente, tipo de problema, servico, categoria, equipamento e tempo aberto.

## Integracao com Inventario

A OS guarda `asset_id` e `environment_id`. A interface exibe dados atuais do ativo quando o ativo ainda existe no inventario.

Nesta etapa, a automacao inicial com manutencao ja existe:

- colocar uma maquina em manutencao cria uma OS aberta de categoria `Manutencao`;
- a OS fica sem tecnico por padrao, esperando o preenchimento do atendimento;
- finalizar a OS tenta retirar a maquina da manutencao e devolver ao segmento anterior;
- se o segmento anterior nao existir mais, o fluxo de inventario usa `Nao organizadas` como retorno seguro.

O codigo fica preparado para proximas evolucoes:

- registrar troca de pecas da OS no historico da maquina;
- gerar OS automaticamente a partir de alerta.

## Abertura publica de chamado

A rota `/abrir-chamado` e sua alternativa `/solicitar-suporte` exibem uma tela isolada, sem sidebar e sem acesso ao painel tecnico.

O usuario final consegue apenas:

- informar titulo, descricao, categoria, tipo de problema e solicitante;
- informar contato, setor, ramal e dados simples da maquina/equipamento;
- enviar a solicitacao;
- receber o numero da OS criada.

A tela usa `GET /api/public/support-options` para carregar categorias e tipos de problema ativos. Se nao houver configuracao, usa opcoes padrao.

Ao enviar, `POST /api/public/service-orders` cria uma OS em `Aberta`, com origem `public_support_form`, prioridade calculada inicialmente e resposta limitada ao numero, data, prioridade e status.

Para o futuro, o instalador/agente do IT Guardian podera criar um atalho na area de trabalho que abre:

```txt
https://dominio-do-it-guardian/abrir-chamado?assetId=...&hostname=...&ambiente=...
```

Esse atalho podera preencher automaticamente identificador da maquina, hostname, IP, usuario logado e ambiente sem expor o inventario completo.

## Fora do escopo desta etapa

- anexos;
- SLA avancado;
- relatorios;
- notificacoes;
- WhatsApp/e-mail;
- integracao real com Zabbix;
- integracao real com OCS;
- criacao automatica por alerta.
- importacao Excel real.
- motor avancado de prioridade.

## Checklist manual

- abrir `Ordens de Servico` pela sidebar;
- criar uma OS com titulo, prioridade e ativo vinculado;
- colocar uma maquina em manutencao e conferir a OS aberta automatica;
- confirmar que a OS aparece em `Aberta`;
- abrir detalhe da OS;
- tentar mover para outro status sem tecnico e confirmar bloqueio;
- informar tecnico responsavel;
- salvar atendimento;
- mudar status para `Em atendimento`;
- mudar status para `Finalizada`;
- confirmar que finalizar OS de manutencao retira a maquina da manutencao;
- abrir `/abrir-chamado`;
- enviar uma solicitacao publica e confirmar que a OS aparece em `Aberta`;
- abrir Configuracoes;
- criar cliente, produto e tecnico;
- criar tipo de problema;
- criar regra de prioridade;
- importar CSV de clientes/produtos;
- conferir historico da OS;
- alternar tema claro/noturno;
- voltar ao Inventario e confirmar que a Fase 1 continua funcionando.
