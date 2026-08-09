# Biblioteca 3D e licencas

## Regra de entrada

Todo ativo precisa ter identificador estavel, categoria, autoria, origem, URL de origem, licenca, dimensoes, escala, rotacao, tags, tipo operacional e indicacao de vinculo ao inventario. O manifesto publico fica em `client/public/assets/3d-library/manifest.json` e os creditos em `ATTRIBUTIONS.md`.

Nao copie modelos, texturas, icones, codigo ou o catalogo proprietario do Sweet Home 3D. Ele e apenas referencia de fluxo. Ativos externos so entram quando a licenca permite redistribuicao e o arquivo de origem e auditavel.

## Fontes atuais

- Kenney Furniture Kit, CC0 1.0.
- Quaternius Ultimate Furniture Pack, CC0 1.0.
- Geometrias procedurais e glifos 2D autorais do IT Guardian.

## Estrutura

`client/public/assets/3d-library/` possui as categorias `structure`, `office`, `it`, `hospital`, `network`, `generic` e `thumbnails`. Modelos antigos continuam em `assets/inventory-map-3d/models` para preservar plantas existentes. O manifesto novo referencia esses caminhos ate uma migracao versionada.

## Pipeline aprovado

1. Confirmar a licenca e registrar autor, URL e texto legal.
2. Inspecionar bibliotecas SH3F licenciadas com `node scripts/floor-plans/inspect-sh3f.mjs arquivo.sh3f`.
3. Extrair apenas conteudo cuja licenca permita redistribuicao.
4. Converter OBJ/DAE para GLB com uma versao fixada de Blender ou glTF Transform.
5. Corrigir eixo Y para cima, origem no piso, escala em metros, pivô central e materiais PBR.
6. Reduzir texturas e malha sem destruir silhueta; preferir WebP/KTX2 quando o runtime estiver configurado.
7. Gerar thumbnail WebP, cadastrar o manifesto e validar o fallback procedural.
8. Rodar testes, build e inspecao visual 2D/3D.

## Orcamento de desempenho

- O catalogo nao carrega GLB; usa glifos SVG e thumbnails.
- A cena 3D e carregada sob demanda e reutiliza o registro de ativos.
- Modelos detalhados possuem fallback procedural quando ausentes ou invalidos.
- Evitar arquivos acima de 5 MB por objeto e texturas maiores que 2048 px sem justificativa.

## Checklist legal

- [ ] Licenca permite uso e redistribuicao.
- [ ] Autor e URL registrados.
- [ ] Nenhum conteudo proprietario foi extraido.
- [ ] Arquivo convertido e otimizado localmente.
- [ ] Fallback e compatibilidade verificados.
