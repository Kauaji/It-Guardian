# Mapa de Infraestrutura

O Mapa de Infraestrutura é a visão física do IT Guardian. Ele preserva o editor de plantas existente e acrescenta uma camada operacional: imagem de fundo protegida, componentes semânticos, vínculos com o inventário, resumo e mapas de calor baseados em dados reais.

## Planta pronta ou construção manual

Há dois caminhos compatíveis:

1. **Enviar planta:** em modo de edição, use `Enviar planta` e selecione PNG, JPG ou WEBP de até 8 MB. O arquivo é validado por MIME e assinatura binária no backend, persistido no banco e entregue apenas pela rota autenticada. Não existe URL pública do arquivo.
2. **Construir manualmente:** continue usando salas, paredes, portas, mesas, racks, ativos, pontos de energia/rede e rotas do catálogo. Upload e construção manual podem ser combinados.

Em `Ajustar fundo` é possível controlar opacidade, escala, posição X/Y e encaixe. Remover a imagem não remove objetos, vínculos ou rotas do mapa.

## Componentes semânticos

Objetos de categoria `asset` podem registrar nome no mapa, descrição técnica, criticidade, status manual, grupo, segmento e vínculo com um ativo real. Quando há vínculo, o painel de visualização mostra estado e métricas reais de CPU, RAM e disco; componentes não vinculados não recebem métricas inventadas.

O editor continua persistindo os objetos em `floor_plan_objects`; nenhuma tabela paralela de componentes foi criada. Metadados semânticos ficam em `metadata`, e os vínculos existentes `linked_asset_id`, `group_id` e `segment_id` foram reaproveitados.

## Modos de operação

- **Planta:** localização física e edição normal.
- **Calor de OS:** agrega OS vinculadas aos ativos posicionados no período selecionado. Peso maior é dado a OS abertas e vencidas.
- **Calor de ativos:** disponibilidade, CPU, RAM, disco, alertas ativos ou quantidade de chamados.
- **Resumo:** componentes, ativos vinculados, online/offline/sem agente, OS abertas/vencidas, alertas críticos e cobertura por grupos/segmentos.

Grupo e segmento filtram as consultas no backend. Os períodos rápidos de OS são 7 dias, 30 dias, mês atual e mês anterior. A legenda visual usa baixo, médio, alto e crítico; o detalhe do componente apresenta os valores que formaram o destaque.

## Camadas e interação

As camadas existentes continuam independentes: cômodos, áreas, objetos, rede, energia e textos. Em visualização, um clique abre o resumo semântico; em edição, o mesmo objeto pode ser movido, redimensionado, rotacionado, nomeado, classificado e vinculado. A visão 3D e o Mapa de Rede não foram substituídos.

## Segurança e permissões

- `floor_plans.view`: visualizar mapa e baixar o fundo protegido;
- `floor_plans.create`, `floor_plans.update`, `floor_plans.delete`: ciclo da planta;
- `floor_plans.link_inventory`: vincular ativo;
- `floor_plans.upload_background`: enviar, substituir ou excluir o fundo;
- `floor_plans.view_heatmaps`: consultar resumo e mapas de calor.

As rotas de upload exigem autenticação, permissão, MIME permitido, assinatura binária válida e limite de 8 MB. HTML, JavaScript, executáveis, SVG e arquivos renomeados são rejeitados.

## Endpoints

- `POST/GET/DELETE /api/floor-plans/:id/floors/:floorId/background`
- `GET /api/floor-plans/:id/summary`
- `GET /api/floor-plans/:id/heatmap/service-orders`
- `GET /api/floor-plans/:id/heatmap/assets`

Os endpoints de calor aceitam `groupId` e `segmentId`. O de OS exige `startDate` e `endDate` (máximo de 366 dias); o de ativos aceita `metric`.

## Limitações da V1

Não há leitura automática por IA, OCR, CAD, colaboração simultânea, PDF, SVG, storage externo, relatório PDF ou cálculo real de cabeamento. Duplicar uma planta não duplica o arquivo de fundo. O armazenamento binário no banco é adequado ao limite atual; instalações grandes devem migrar os bytes para storage privado mantendo a mesma rota autenticada.
