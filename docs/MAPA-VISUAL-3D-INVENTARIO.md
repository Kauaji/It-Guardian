# Mapa Visual 3D do Inventario

## Objetivo

O Mapa Visual 3D e uma camada complementar do Inventario para representar ambientes, segmentos, estruturas fisicas, ativos, infraestrutura tecnica e eletrica em uma cena leve. A implementacao atual prioriza persistencia, edicao segura e visualizacao tecnica, sem simulacao fisica, roteamento automatico, descoberta de rede ou execucao de comandos.

## Onde fica

No modulo Inventario, o usuario pode alternar entre:

- Quadro: visualizacao tradicional do inventario.
- Plantas: editor de plantas e ambientes em 2D/3D.
- Mapa visual 3D: mapas de ambientes com objetos estruturais, ativos vinculados, infraestrutura e eletrica.

O Mapa visual 3D e carregado sob demanda. Abrir o Inventario ou usar Quadro e Plantas nao baixa o codigo Three.js da cena.

## Persistencia

A fonte da verdade fica no backend. As tabelas principais sao:

- `inventory_visual_maps`: dados do mapa, ambiente, grupo, segmento, dimensoes, escala, observacoes e auditoria.
- `inventory_visual_map_objects`: objetos do mapa, camada, preset, posicao, rotacao, dimensoes, cor, ativo vinculado, metadados e auditoria.
- `inventory_visual_map_connections`: conexoes manuais do mapa, camada, tipo, origem/destino opcionais, pontos manuais, cor, espessura, tracejado, observacoes, metadados e auditoria.

As mutacoes registram logs de auditoria. Quando um objeto e vinculado a um ativo real, o historico do ativo tambem recebe registro.

Um ativo pode aparecer apenas uma vez em cada mapa. Essa regra e validada no backend e protegida por indice unico; o frontend tambem sinaliza ativos ja posicionados. O mesmo ativo pode continuar existindo em mapas diferentes.

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
- `InventoryBoard`: alternancia entre Quadro, Plantas e Mapa visual 3D.

`InventoryVisualMapView` e importado de forma lazy pelo `App`, de modo que a cena adicional nao interfere no carregamento principal do inventario.

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
- Avisar antes de trocar mapa, atualizar ou sair do modo de edicao com alteracoes nao salvas.
- Mover objetos por controles numericos ou botoes de deslocamento.
- Ajustar posicao XYZ, rotacao XYZ, tamanho, cor, nome e observacoes.
- Duplicar objetos sem duplicar o vinculo com o ativo real.
- Vincular objetos a ativos reais do inventario.
- Abrir painel com informacoes do ativo vinculado.
- Editar pontos manuais, estilo e metadados de conexoes.
- Usar OrbitControls para aproximar, afastar, orbitar e navegar pela cena.
- Enquadrar o mapa, centralizar o objeto selecionado e redefinir a camera.
- Ajustar a escala visual da grade.

A cena renderiza por demanda: interacoes, alteracoes de dados e redimensionamento disparam um novo quadro, sem manter um loop continuo quando o mapa esta parado.

## Limitacoes conhecidas

- Nao ha drag-and-drop direto dentro da cena 3D.
- Nao ha importacao de planta baixa.
- Nao ha roteamento automatico de cabos.
- Nao ha calculo eletrico, carga, disjuntor real ou validacao normativa.
- Nao ha descoberta automatica de switches, portas ou topologia.
- Nao ha modelos 3D detalhados ou texturas pesadas.
- Nao ha fisica, sombras complexas ou simulacao de ocupacao.
- O uso em telas pequenas e funcional, mas edicoes extensas continuam mais ergonomicas em desktop.

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
3. Confirmar que Quadro e Plantas continuam funcionando antes e depois da troca.
4. Criar mapa com dimensoes, escala e contexto.
5. Trocar de mapa com alteracao pendente e validar a confirmacao de descarte.
6. Alternar entre visualizacao e edicao e confirmar que campos ficam bloqueados no modo de visualizacao.
7. Criar objeto estrutural.
8. Criar objeto de ativo.
9. Tentar adicionar o mesmo ativo novamente e confirmar o bloqueio.
10. Criar objeto de infraestrutura.
11. Criar objeto eletrico.
12. Duplicar um objeto e confirmar que a copia nao herda o ativo vinculado.
13. Criar conexao de infraestrutura.
14. Criar conexao eletrica.
15. Selecionar objetos e conexoes na cena.
16. Editar posicao, tamanho, cor, rotacao, pontos manuais e metadados.
17. Testar enquadrar mapa, centralizar selecao e redefinir camera.
18. Alternar camadas e confirmar que itens ocultos nao sao selecionaveis.
19. Recarregar a pagina e confirmar persistencia.
20. Repetir visualizacao em desktop, tablet e celular, verificando scroll e controles da camera.
