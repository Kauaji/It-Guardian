# Mapa Visual 3D do Inventario

## Objetivo

O Mapa Visual 3D e uma camada complementar do Inventario para representar ambientes, segmentos, estruturas fisicas, ativos, infraestrutura tecnica e eletrica em uma cena leve. A implementacao atual prioriza persistencia, edicao segura e visualizacao tecnica, sem simulacao fisica, roteamento automatico, descoberta de rede ou execucao de comandos.

## Onde fica

No modulo Inventario, o usuario pode alternar entre:

- Quadro: visualizacao tradicional do inventario.
- Mapa visual 3D: mapas de ambientes com objetos estruturais, ativos vinculados, infraestrutura e eletrica.

## Persistencia

A fonte da verdade fica no backend. As tabelas principais sao:

- `inventory_visual_maps`: dados do mapa, ambiente, grupo, segmento, dimensoes, escala, observacoes e auditoria.
- `inventory_visual_map_objects`: objetos do mapa, camada, preset, posicao, rotacao, dimensoes, cor, ativo vinculado, metadados e auditoria.
- `inventory_visual_map_connections`: conexoes manuais do mapa, camada, tipo, origem/destino opcionais, pontos manuais, cor, espessura, tracejado, observacoes, metadados e auditoria.

As mutacoes registram logs de auditoria. Quando um objeto e vinculado a um ativo real, o historico do ativo tambem recebe registro.

## Endpoints

Mapas:

- `GET /api/inventory-visual-maps`
- `GET /api/inventory-visual-maps/:id`
- `POST /api/inventory-visual-maps`
- `PUT /api/inventory-visual-maps/:id`
- `DELETE /api/inventory-visual-maps/:id`

Objetos:

- `GET /api/inventory-visual-map-objects?mapId=:id`
- `POST /api/inventory-visual-map-objects`
- `PUT /api/inventory-visual-map-objects/:id`
- `DELETE /api/inventory-visual-map-objects/:id`

Conexoes:

- `GET /api/inventory-visual-maps/:id/connections`
- `POST /api/inventory-visual-maps/:id/connections`
- `PATCH /api/inventory-visual-map-connections/:connectionId`
- `DELETE /api/inventory-visual-map-connections/:connectionId`

## Permissoes

- Visualizacao: `inventory.view`.
- Criacao, edicao e remocao: `inventory.manage_segments`.

O frontend apenas esconde controles quando o usuario nao possui permissao. O backend continua validando as permissoes.

## Componentes

- `InventoryVisualMapView`: composicao da tela, mapas, objetos, conexoes, camadas, modo de edicao, formularios e painel lateral.
- `InventoryVisualMapScene`: cena Three.js, piso, grade, camera, OrbitControls, objetos, conexoes e selecao por clique.
- `InventoryVisualMapLayerPresetBar`: visualizacoes rapidas e toggles de camadas.
- `InventoryVisualMapConnectionPanel`: resumo da conexao selecionada.
- `InventoryVisualMapConnectionEditor`: edicao de camada, tipo, pontos manuais, estilo, metadados e notas da conexao.
- `InventoryBoard`: alternancia entre quadro tradicional e mapa visual 3D.

## Camadas

- `structure`: estrutura fisica do ambiente.
- `assets`: ativos vinculados ou representados no mapa.
- `infrastructure`: rede, rack, cabeamento tecnico e pontos de conectividade.
- `electrical`: pontos eletricos, circuitos, nobreaks, quadros e alimentacao.

Visualizacoes rapidas:

- Tudo
- Estrutura
- Ativos
- Infra
- Eletrica
- Infra + ativos
- Eletrica + ativos

Camadas ocultas nao ficam selecionaveis na cena.

## Presets de objetos

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

Infraestrutura:

- ponto de rede
- cabo
- backbone
- rack tecnico
- switch
- roteador
- access point
- patch panel
- camera IP

Eletrica:

- ponto eletrico
- tomada
- linha
- circuito
- quadro eletrico
- nobreak

## Tipos de conexao

Infraestrutura:

- `network_cable`
- `backbone`
- `uplink`
- `rack_link`
- `ap_coverage_link`

Eletrica:

- `power_line`
- `circuit_line`
- `ups_line`

As conexoes usam pontos manuais. Nao ha roteamento automatico ou calculo tecnico de carga.

## Metadados opcionais

Objetos de infraestrutura/eletrica e conexoes podem registrar:

- circuito
- tensao
- quadro
- disjuntor
- criticidade
- nota

## Controles atuais

- Criar, editar e excluir mapas.
- Criar, editar e excluir objetos.
- Criar, editar e excluir conexoes.
- Alternar camadas e visualizacoes rapidas.
- Alternar modo visualizacao/edicao.
- Mover objetos por controles numericos ou botoes de deslocamento.
- Ajustar rotacao, tamanho, cor, nome e observacoes.
- Vincular objetos a ativos reais do inventario.
- Abrir painel com informacoes do ativo vinculado.
- Editar pontos manuais, estilo e metadados de conexoes.
- Usar OrbitControls para aproximar, afastar, orbitar e navegar pela cena.

## Limitacoes conhecidas

- Nao ha drag-and-drop direto dentro da cena 3D.
- Nao ha importacao de planta baixa.
- Nao ha roteamento automatico de cabos.
- Nao ha calculo eletrico, carga, disjuntor real ou validacao normativa.
- Nao ha descoberta automatica de switches, portas ou topologia.
- Nao ha modelos 3D detalhados ou texturas pesadas.
- Nao ha fisica, sombras complexas ou simulacao de ocupacao.
- O uso em telas pequenas e funcional, mas a edicao precisa de mais refinamento em fases futuras.

## Roadmap sugerido

- Arrastar objetos diretamente na cena.
- Importar planta baixa como referencia.
- Criar snapping e alinhamento por grade.
- Criar assistente para posicionamento automatico a partir de grupo/segmento.
- Exibir estados operacionais em tempo real nos ativos.
- Criar relatorios por ambiente visual.
- Criar leitura tecnica futura via agente seguro, sem execucao direta pelo servidor.

## Checklist manual

1. Abrir Inventario.
2. Alternar para Mapa visual 3D.
3. Criar mapa com dimensoes e contexto.
4. Criar objeto estrutural.
5. Criar objeto de ativo.
6. Criar objeto de infraestrutura.
7. Criar objeto eletrico.
8. Vincular um ativo real.
9. Criar conexao de infraestrutura.
10. Criar conexao eletrica.
11. Selecionar objetos e conexoes na cena.
12. Editar posicao, tamanho, cor, rotacao, pontos manuais e metadados.
13. Alternar camadas e confirmar que itens ocultos nao sao selecionaveis.
14. Recarregar a pagina e confirmar persistencia.
