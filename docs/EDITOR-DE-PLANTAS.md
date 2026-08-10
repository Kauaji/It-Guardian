# Editor de plantas

## Direcao do produto

O editor usa aplicativos de planta como referencia de ergonomia, sem copiar codigo, icones, texturas, catalogos ou modelos proprietarios. A identidade visual e os componentes sao do IT Guardian. O objetivo e manter uma superficie clara para usuarios leigos, com planta 2D, visualizacao 3D sincronizada e vinculo opcional aos ativos reais do inventario.

## Arquitetura preservada

- `FloorPlansModule.jsx` continua responsavel por estado, persistencia, selecao, historico de desfazer/refazer e integracao com inventario.
- `FloorPlanObjectGlyph.jsx` desenha representacoes 2D leves e reconheciveis.
- `FloorPlanScene3D.jsx` carrega a cena somente no modo 3D e resolve modelos pelo registro central.
- `floorPlanCatalog.js` organiza os itens expostos ao usuario.
- `floorPlanLibrary.js` concentra metadados, dimensoes, procedencia e fallback.
- `editorGeometry.js` mantem operacoes puras e compativeis para normalizar, duplicar, rotacionar, vincular e bloquear objetos.

IDs, coordenadas, rotacoes, dimensoes e vinculos antigos permanecem validos. Metadados novos sao opcionais e a normalizacao preenche apenas o que estiver ausente.

## Experiencia 2D

O modo 2D oferece grid claro, escala visual, pan, zoom, snapping, selecao simples e multipla, arraste, redimensionamento, rotacao, duplicacao, exclusao, bloqueio, desfazer/refazer e labels que nao giram com o objeto. Paredes usam contorno forte, portas exibem arco de abertura, janelas usam linhas duplas e os objetos recebem glifos de planta baixa adequados ao tipo.

O catalogo inferior possui:

- categorias operacionais;
- busca global sem diferenca de acento ou caixa;
- favoritos;
- preview 2D leve;
- indicacao de itens vinculaveis;
- insercao por clique no catalogo seguida de clique na planta;
- layout horizontal compacto para desktop e viewport reduzido.

Ao selecionar um objeto, a barra de acoes permite duplicar, rotacionar, bloquear/desbloquear e excluir. Um objeto bloqueado pode ser selecionado e inspecionado, mas nao pode ser arrastado, redimensionado, rotacionado ou excluido ate ser desbloqueado. Copias sempre nascem desbloqueadas e sem herdar o vinculo do original.

## Experiencia 3D

A alternancia 2D/3D e explicita. A cena 3D e derivada dos mesmos objetos persistidos pela planta 2D, portanto posicao, escala, rotacao e remocao permanecem sincronizadas.

No modo detalhado, cada GLB e carregado sob demanda. O catalogo nao baixa modelos 3D. Se um arquivo estiver ausente, invalido ou nao existir para aquele tipo, a cena usa uma geometria procedural reconhecivel. Computadores, notebooks e outros equipamentos apoiados em mesas recebem elevacao calculada para evitar intersecao com o tampo.

Objetos bloqueados continuam selecionaveis no 3D, mas nao iniciam arraste. A cena preserva orbita, enquadramento e indicadores sutis de status para itens vinculados.

## Vinculo com inventario

Itens marcados com `linkableToInventory` podem receber `linkedAssetId`. O vinculo nao substitui a geometria: ele adiciona nome operacional, grupo, segmento e status ao objeto visual. Duplicar um objeto remove o vinculo para impedir duas representacoes apontando acidentalmente para o mesmo ativo.

Estados online, offline, erro e sem dados sao representados sem alterar o modelo. Plantas antigas que ja guardavam um vinculo continuam abrindo com o mesmo identificador.

## Biblioteca

A biblioteca atual contem 63 definicoes nas categorias estrutura, escritorio, TI, hospitalar, rede e energia. Trinta e nove usam GLB CC0 e vinte e quatro usam geometria procedural ou glifo autoral. O manifesto publico e a procedencia de cada item ficam em `client/public/assets/3d-library/`.

Consulte `BIBLIOTECA-3D-E-LICENCAS.md` antes de incluir ou trocar qualquer modelo.

## Como adicionar um item

1. Confirme a licenca e a possibilidade de redistribuicao.
2. Inclua o GLB otimizado em `client/public/assets/3d-library/models/<fonte>/`, ou defina um fallback procedural.
3. Cadastre dimensoes reais, escala, rotacao, tags e procedencia em `floorPlanLibrary.js`.
4. Adicione o item ao catalogo e crie um glifo 2D coerente.
5. Execute `npm run floorplans:manifest` para sincronizar o manifesto.
6. Registre os creditos em `ATTRIBUTIONS.md`.
7. Rode os testes, o build e confira visualmente 2D e 3D.

## Validacao

```text
npm run floorplans:manifest
node --test --test-reporter=spec server/test/floorPlanLibrary.test.mjs
npm run lint
npm run check:architecture
npm run build
git diff --check
```

O teste focado verifica manifesto, categorias, procedencia, limite de tamanho, busca, inclusao por template, compatibilidade antiga, duplicacao, rotacao, vinculo, remocao, posicionamento 3D e fallback.

## Limites conhecidos

- Itens hospitalares sem modelo CC0 revisado usam geometria procedural.
- O preview do catalogo e um glifo vetorial; thumbnails WebP automaticos ainda dependem de um renderizador isolado.
- A importacao SH3F e assistida e nunca importa automaticamente um pacote sem auditoria de licenca.
- O editor nao pretende substituir um sistema CAD ou BIM de precisao tecnica.
