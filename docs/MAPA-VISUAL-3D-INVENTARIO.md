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

## Limitacoes conhecidas do Mapa Visual 3D

- O modulo `InventoryVisualMap` ainda nao possui drag-and-drop direto dentro da cena 3D.
- Nao ha importacao de planta baixa.
- Nao ha roteamento automatico de cabos.
- Nao ha calculo eletrico, carga, disjuntor real ou validacao normativa.
- Nao ha descoberta automatica de switches, portas ou topologia.
- Nao ha modelos 3D detalhados ou texturas pesadas.
- Nao ha fisica, sombras complexas ou simulacao de ocupacao.
- O uso em telas pequenas e funcional, mas edicoes extensas continuam mais ergonomicas em desktop.

## Roadmap sugerido

- Arrastar objetos diretamente na cena do `InventoryVisualMap`.
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

## Editor de Plantas 2D/3D

O editor acessado por Plantas usa o mesmo cadastro de plantas e pavimentos ja existente. Este fluxo e separado do `InventoryVisualMap`: ele serve para desenhar ambientes, paredes, aberturas e objetos de uma planta, mantendo uma visualizacao 3D leve e sincronizada com o editor 2D.

### Persistencia e compatibilidade

As novas relacoes ficam no JSON do editor e nao exigem uma tabela paralela. Objetos antigos continuam validos porque os metadados de ancoragem sao opcionais.

Paredes e divisorias registram:

- `geometryVersion`
- `startPoint`
- `endPoint`
- comprimento, espessura, rotacao e altura 3D

Portas e janelas vinculadas registram:

- `anchorType: wall`
- `parentObjectId`
- `anchorOffset`, entre 0 e 1
- `anchorMetadata` com altura da abertura, peitoril e sentido de abertura quando aplicavel

Ao mover, redimensionar ou girar uma parede, suas aberturas acompanham a nova geometria. Ao excluir a parede, as aberturas filhas tambem sao removidas. O backend valida o pai, o pavimento e o intervalo da posicao relativa antes de persistir.

### Edicao 2D

- Salas e corredores podem ser criados por clique ou por arraste.
- Paredes e divisorias sao criadas informando inicio e fim.
- O fim da parede usa grade e angulos de 45 graus.
- Portas e janelas so podem ser adicionadas quando existe uma parede proxima.
- Aberturas podem ser reposicionadas ao longo da parede pelo inspetor.
- Comprimento, espessura, angulo e altura 3D da parede podem ser ajustados no inspetor.
- A selecao, o historico de desfazer/refazer e a normalizacao do editor continuam usando o estado central da planta.

### Edicao e visualizacao 3D

- A cena usa modelos procedurais leves para estrutura, moveis, ativos, rede e energia.
- O seletor `Simples/Detalhado` guarda a preferencia local do tecnico. O modo detalhado tenta carregar apenas modelos locais registrados; se o arquivo nao existir, o modelo procedural continua visivel.
- O registro de modelos fica em `client/src/components/floorPlans/assets/inventoryMapAssetRegistry.js` e as licencas devem ser registradas em `client/public/assets/inventory-map-3d/models/ASSET-LICENSES.md`.
- Objetos podem ser selecionados diretamente na cena.
- Objetos comuns podem ser arrastados no plano do pavimento.
- A selecao pode ser girada em incrementos simples pelo controle da cena.
- Selecao, posicao e rotacao permanecem sincronizadas com o inspetor e a vista 2D.
- A renderizacao acontece por demanda, inclusive durante navegacao, selecao e redimensionamento.
- Sombras pesadas e loop continuo de animacao permanecem desativados.

Em telas pequenas, o editor continua acessivel com scroll interno e controles reorganizados, mas a edicao detalhada de uma planta e recomendada em desktop ou notebook.

### Demarcacao de areas com pincel

O editor usa uma mascara 2D em grade sobre o piso. A mascara e consolidada em faixas na visualizacao 3D para evitar uma malha por pincelada.

#### Pincel de Grupo

- `Pincel` pinta ao clicar e arrastar.
- `Completar area` preenche o interior de um comodo pronto reconhecido pelo editor.
- `Borracha` apaga somente a demarcacao temporaria.
- O tamanho pequeno, medio ou grande afeta pincel e borracha.
- `Confirmar area` exige pintura e um grupo valido antes de salvar.
- `Cancelar area` descarta somente a pintura temporaria.

#### Pincel de Segmento

- Fica indisponivel enquanto nao existe uma area de grupo salva.
- Exige a escolha da area de grupo pai e de um segmento compativel.
- Pincel, borracha e preenchimento sao recortados pelas celulas do grupo pai e nao ultrapassam seu limite.
- Ao confirmar, a area registra `parentAreaId`, `groupId` e `segmentId`.

As areas usam zonas com `geometry.kind: paint-mask`, `cellSize` e uma lista consolidada de celulas. Recarregar o editor restaura as demarcacoes pelo mesmo JSON persistido da planta. Nesta versao o balde cobre comodos prontos retangulares; deteccao de regioes complexas formadas por paredes livres continua como limitacao conhecida.

### Checklist manual do editor de Plantas

1. Criar uma planta e um pavimento.
2. Criar uma sala por clique e outra por arraste.
3. Criar uma parede horizontal, uma vertical e uma diagonal.
4. Alterar comprimento, espessura, angulo e altura 3D da parede.
5. Inserir porta e janela sobre uma parede.
6. Mover e girar a parede e confirmar que as aberturas acompanham.
7. Reposicionar uma abertura pelo controle de posicao na parede.
8. Excluir uma parede e confirmar a remocao de suas aberturas.
9. Alternar para 3D, selecionar um objeto e arrasta-lo.
10. Girar a selecao no 3D e confirmar a atualizacao no 2D e no inspetor.
11. Salvar, recarregar e confirmar que paredes, aberturas e vinculos foram preservados.
12. Abrir uma planta antiga sem ancoragem e confirmar que ela continua editavel.
13. Abrir o Pincel de Grupo, pintar, mudar o tamanho e apagar parte da area.
14. Usar o balde dentro de um comodo pronto e validar o aviso fora de uma area reconhecida.
15. Cancelar a demarcacao e confirmar que nenhuma area foi salva.
16. Pintar novamente, confirmar, escolher um grupo e salvar.
17. Abrir o Pincel de Segmento, selecionar o grupo pai e pintar dentro dele.
18. Tentar pintar fora do grupo e confirmar que a pintura foi recortada.
19. Confirmar o segmento, recarregar a pagina e validar a persistencia das duas areas.
20. Alternar entre modelos Simples e Detalhados e confirmar o fallback procedural sem erros.
