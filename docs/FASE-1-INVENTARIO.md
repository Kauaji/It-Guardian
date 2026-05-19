# Fase 1 - Inventario

Este documento registra o escopo estabilizado da Fase 1 do IT Guardian antes da expansao para Ordens de Servico.

## Objetivo

Entregar uma versao confiavel do inventario para demonstracao online e uso como base de evolucao. A arquitetura atual funciona no Vercel com API leve e banco PostgreSQL externo, mantendo separadas as integracoes futuras que exigem VPS ou agente dentro da rede.

## Funcionalidades concluidas

- Autenticacao com login, cadastro e JWT.
- Dashboard com indicadores, alertas e historico.
- Inventario multiambiente por abas.
- Grupos e segmentos por aba.
- Sidebar hierarquica com grupos, segmentos e contadores.
- Segmento especial `Nao organizadas` para maquinas sem alocacao final.
- Segmento automatico `Manutencao` criado apenas quando necessario.
- Cadastro manual de ativos de rede.
- Cards compactos para maquinas e ativos.
- Selecao multipla de equipamentos.
- Drag-and-drop de maquinas e multiplas maquinas.
- Drag-and-drop de segmentos entre grupos, inclusive pela sidebar.
- Busca e filtros respeitando a aba ativa.
- Ficha grande de maquina/ativo com abas internas.
- Historico, observacoes, perifericos e alteracao de tipo.
- Remocao segura de perifericos e maquinas.
- QR Code individual e impressao em etiqueta Zebra.
- Modo claro e modo noturno.
- Servicos mockados/preparados para ping, OCS e Zabbix.

## Decisoes tecnicas

- Frontend em React + Vite.
- Drag-and-drop com `@dnd-kit`.
- Icones com Lucide React.
- API Express separada entre app serverless (`api/index.js`) e servidor local (`server/src/server.js`).
- Persistencia via PostgreSQL usando `DATABASE_URL`.
- `DATABASE_URL=memory` permitido somente para desenvolvimento/demo local.
- Ping, OCS e Zabbix ficam atras de services/adapters para futura troca em VPS.
- QR Code usa URL publica do frontend quando configurada por `FRONTEND_URL`/`VITE_FRONTEND_URL`.

## Regras importantes do inventario

- `Todos` e apenas filtro.
- `Nao organizadas` e area especial do sistema, sem acoes comuns de segmento.
- `Manutencao` e nome reservado e so deve ser criado pelo sistema.
- Segmentos podem repetir nome em grupos diferentes.
- Segmentos nao podem repetir nome dentro do mesmo grupo.
- Maquinas sem segmento definitivo aparecem em `Nao organizadas`.
- Ao mover uma maquina para um segmento real, ela passa a pertencer a aba daquele ambiente.
- Ao colocar uma maquina em manutencao, o sistema salva o segmento de origem.
- Ao retirar da manutencao, a maquina volta ao segmento original ou para `Nao organizadas` se a origem nao existir mais.

## Limitacoes conhecidas

- Ping real ainda nao roda no Vercel.
- OCS Inventory real ainda nao esta conectado.
- Zabbix real ainda nao esta conectado.
- Monitoramento continuo/background jobs exigem VPS ou agente na rede interna.
- IPs internos como `10.10.x.x` nao sao acessiveis diretamente pelo Vercel.
- A build ainda alerta sobre bundle JavaScript acima de 500 kB; e aceitavel para a Fase 1, mas pode ser otimizado com code splitting no futuro.

## Checklist de teste da Fase 1

- Login e cadastro.
- Dashboard carregando indicadores.
- Inventario carregando abas, grupos, segmentos e cards.
- Criar, renomear, colorir e excluir aba.
- Criar, renomear, colorir, ordenar e excluir grupo.
- Criar, renomear, colorir, ordenar e excluir segmento.
- Criar segmento com mesmo nome em grupos diferentes.
- Bloquear segmento chamado `Manutencao` ou `Nao organizadas`.
- Arrastar maquina para outro segmento.
- Arrastar maquina para segmento pela sidebar.
- Selecionar varias maquinas e mover em massa.
- Arrastar segmento para outro grupo.
- Buscar por nome, IP, tipo, marca, modelo, patrimonio e segmento.
- Filtrar por grupo e segmento.
- Abrir ficha de maquina/ativo.
- Editar nome fantasia.
- Alterar tipo do aparelho.
- Abrir perifericos e remover periferico.
- Adicionar observacao.
- Colocar maquina em manutencao.
- Retirar maquina da manutencao.
- Remover maquina do inventario.
- Imprimir QR Code em etiqueta.
- Alternar entre modo claro e noturno.
- Testar com sidebar aberta/recolhida.
- Rodar `npm run build`.

## Proximos passos

- Modulo de Ordens de Servico.
- Cadastro de clientes/empresas mais completo.
- Tecnicos, chamados e fluxo de atendimento.
- Integracao real com OCS Inventory.
- Integracao real com Zabbix.
- Ping real e jobs em VPS.
- Relatorios e exportacoes.
