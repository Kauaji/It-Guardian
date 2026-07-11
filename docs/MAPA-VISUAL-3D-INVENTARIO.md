# Mapa Visual 3D do Inventario

## Objetivo

O Mapa Visual 3D e uma camada complementar do Inventario para representar ambientes, segmentos, estruturas fisicas e ativos em uma cena tecnica leve. A fase 1 prioriza organizacao visual, vinculacao com ativos reais e persistencia segura, sem simulacao fisica, renderizacao pesada ou execucao de comandos.

## Onde fica

No modulo Inventario, o usuario pode alternar entre:

- Quadro: visualizacao tradicional do inventario.
- Mapa visual 3D: mapas de ambientes com objetos estruturais e ativos vinculados.

## Persistencia

A fonte da verdade fica no backend. Foram adicionadas as tabelas:

- `inventory_visual_maps`: dados do mapa, ambiente, grupo, segmento, dimensoes, escala, observacoes e auditoria.
- `inventory_visual_map_objects`: objetos do mapa, camada, preset, posicao, rotacao, dimensoes, cor, ativo vinculado, metadados e auditoria.

As mutacoes registram logs de auditoria. Quando um objeto e vinculado a um ativo real, o historico do ativo tambem recebe registro.

## Endpoints

- `GET /api/inventory-visual-maps`
- `GET /api/inventory-visual-maps/:id`
- `POST /api/inventory-visual-maps`
- `PUT /api/inventory-visual-maps/:id`
- `DELETE /api/inventory-visual-maps/:id`
- `GET /api/inventory-visual-map-objects?mapId=:id`
- `POST /api/inventory-visual-map-objects`
- `PUT /api/inventory-visual-map-objects/:id`
- `DELETE /api/inventory-visual-map-objects/:id`

## Permissoes

- Visualizacao: `inventory.view`.
- Criacao, edicao e remocao: `inventory.manage_segments`.

O frontend apenas esconde controles quando o usuario nao possui permissao. O backend continua validando as permissoes.

## Componentes

- `InventoryVisualMapView`: composicao da tela, mapas, objetos, camadas, modo de edicao, formularios e painel lateral.
- `InventoryVisualMapScene`: cena Three.js, piso, grade, camera, OrbitControls, objetos e selecao por clique.
- `InventoryBoard`: alternancia entre quadro tradicional e mapa visual 3D.

## Presets

Estrutura:

- parede
- divisoria
- sala
- corredor
- mesa
- rack

Ativos:

- desktop
- notebook
- servidor
- switch
- roteador
- access point
- impressora
- nobreak
- ponto de rede
- ponto eletrico

## Controles da fase 1

- Criar, editar e excluir mapas.
- Criar, editar e excluir objetos.
- Alternar camadas de estrutura e ativos.
- Alternar modo visualizacao/edicao.
- Mover objetos por controles numericos ou botoes de deslocamento.
- Ajustar rotacao, tamanho, cor, nome e observacoes.
- Vincular objetos a ativos reais do inventario.
- Abrir painel com informacoes do ativo vinculado.
- Usar OrbitControls para aproximar, afastar, orbitar e navegar pela cena.

## Limitacoes conhecidas da fase 1

- Nao ha drag-and-drop direto dentro da cena 3D.
- Nao ha importacao de planta baixa.
- Nao ha malha eletrica, infraestrutura de cabos ou rotas automaticas.
- Nao ha modelos 3D detalhados ou texturas pesadas.
- Nao ha fisica, sombras complexas ou simulacao de ocupacao.
- O uso em telas pequenas e funcional, mas a edicao precisa de mais refinamento em fases futuras.

## Roadmap sugerido

- Arrastar objetos diretamente na cena.
- Importar planta baixa como referencia.
- Criar camadas de rede, energia e manutencao.
- Exibir estados operacionais em tempo real nos ativos.
- Criar assistente para posicionamento automatico a partir de grupo/segmento.
- Criar relatorios por ambiente visual.

## Checklist manual

1. Abrir Inventario.
2. Alternar para Mapa visual 3D.
3. Criar mapa com dimensoes e contexto.
4. Criar objeto estrutural.
5. Criar objeto de ativo.
6. Vincular um ativo real.
7. Selecionar objeto na cena.
8. Editar posicao, tamanho, cor e rotacao.
9. Alternar camadas.
10. Recarregar a pagina e confirmar persistencia.
