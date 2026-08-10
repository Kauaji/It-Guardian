# Biblioteca 3D e licencas

## Politica legal

Sweet Home 3D e outras referencias sao usadas somente para estudar fluxo e ergonomia. Nao e permitido copiar ou extrair codigo, modelos, texturas, icones ou catalogos de APK, IPA, aplicativo, site fechado ou pacote proprietario. Um asset com licenca incerta nao entra no repositorio.

Fontes permitidas:

- ativos CC0 com pagina de origem auditavel;
- modelos criados pelo proprio projeto;
- geometrias procedurais em Three.js;
- pacotes SH3F apenas quando autoria, licenca e redistribuicao estiverem claras.

Fontes proibidas incluem modelos sem licenca, extracoes de aplicativos, bibliotecas fechadas e conteudo cuja licenca proiba redistribuicao como parte de outra biblioteca.

## Inventario atual

O manifesto `client/public/assets/3d-library/manifest.json` possui 63 ativos:

- 11 de estrutura;
- 24 de escritorio;
- 10 de TI;
- 7 hospitalares;
- 8 de rede;
- 3 de energia.

Trinta e nove ativos possuem GLB CC0 1.0 e vinte e quatro usam conteudo autoral do IT Guardian. As fontes externas atuais sao Kenney Furniture Kit e Quaternius Ultimate Furniture Pack. Os arquivos ficam em `models/kenney/` e `models/quaternius/`; os detalhes individuais estao em `ATTRIBUTIONS.md`.

## Contrato do manifesto

Cada entrada registra, no minimo:

- `id`, `name`, `category` e `subcategory`;
- `modelPath` e `thumbnailPath`;
- dimensoes, escala e rotacao padrao;
- tags e tipo de fallback;
- licenca, autor, fonte, URLs e data de consulta;
- formato original/final e indicacao de conversao;
- `linkableToInventory` e `canShowStatus`;
- estrategias `render2d` e `render3d`.

O manifesto e gerado a partir do registro de runtime por `npm run floorplans:manifest`. Nao edite contagens manualmente.

## Inclusao de um modelo

1. Abra a pagina oficial da fonte e confirme uso e redistribuicao.
2. Registre autor, fonte, URL, licenca, URL da licenca e data de consulta.
3. Guarde o arquivo original fora do bundle de producao quando ele nao for o formato final.
4. Converta para GLB com uma versao fixada de Blender CLI ou glTF Transform.
5. Use Y para cima, origem no piso, escala coerente em metros e pivo central.
6. Reduza malha e materiais preservando a silhueta; comprima texturas para WebP/KTX2 somente quando o runtime suportar.
7. Mantenha cada modelo abaixo de 5 MB e evite texturas acima de 2048 px sem justificativa.
8. Gere um thumbnail WebP ou forneca um glifo 2D autoral.
9. Cadastre o item em `floorPlanLibrary.js`, sincronize o manifesto e atualize `ATTRIBUTIONS.md`.
10. Teste escala, orientacao, fallback e carregamento em viewport reduzido.

## Bibliotecas SH3F

O comando abaixo apenas inspeciona a estrutura de um pacote local:

```text
npm run floorplans:inspect-sh3f -- caminho/arquivo.sh3f
```

O fluxo aprovado e:

1. localizar metadados, OBJ/DAE/MTL e texturas;
2. verificar cada autor e licenca;
3. extrair somente arquivos redistribuiveis;
4. converter e otimizar manualmente;
5. gerar preview;
6. cadastrar no manifesto e nas atribuicoes.

O script nao baixa pacotes, nao converte automaticamente e nao presume que um SH3F e livre. Essa restricao evita incorporar conteudo de terceiros sem autorizacao.

## Desempenho e fallback

- O catalogo usa SVG e nao carrega GLB.
- O modo 3D faz lazy-load apenas dos modelos presentes na cena.
- O registro permite compartilhar modelos entre instancias.
- Todo item precisa de fallback procedural identificavel.
- Uma falha de rede ou decodificacao nao pode tornar a planta vazia.
- Modelos legados continuam resolvidos para preservar plantas existentes.

## Geracao de thumbnails

O thumbnail deve usar camera ortografica, fundo transparente ou neutro, iluminacao simples e enquadramento consistente. Exporte em WebP, registre o caminho no manifesto e mantenha o glifo vetorial como fallback. O pipeline automatico de renderizacao ainda nao faz parte do build padrao.

## Checklist de revisao

- [ ] A licenca permite uso e redistribuicao.
- [ ] Autor, fonte, URLs e data estao registrados.
- [ ] O modelo nao foi extraido de aplicativo ou biblioteca proprietaria.
- [ ] Escala, pivo, orientacao e dimensoes foram conferidos.
- [ ] O arquivo respeita o limite de 5 MB.
- [ ] Existe representacao 2D e fallback 3D.
- [ ] O catalogo nao carrega o GLB antecipadamente.
- [ ] Testes, lint, arquitetura, build e inspecao visual passaram.
