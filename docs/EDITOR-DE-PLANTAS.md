# Editor de plantas

## Experiencia

O editor combina catalogo inferior pesquisavel, favoritos, colocacao por clique, selecao simples e multipla, arraste, rotacao, redimensionamento, snapping, zoom, pan, camadas, desfazer/refazer e visualizacao 2D/3D. Objetos vinculaveis podem representar ativos reais do inventario sem misturar a geometria com os dados operacionais.

## Biblioteca

As categorias operacionais sao estrutura, escritorio, TI, hospitalar, rede e genericos. O catalogo usa glifos 2D leves e a cena 3D resolve modelos detalhados pelo registro central. Quando um GLB nao existe ou falha, uma geometria procedural identificavel e exibida.

## Compatibilidade

IDs e caminhos antigos sao preservados. Novos metadados sao opcionais para plantas existentes. O registro novo somente complementa o resolvedor legado; nao altera coordenadas, rotacao, dimensoes ou vinculos salvos.

## Inclusao de ativos

Consulte `BIBLIOTECA-3D-E-LICENCAS.md`. Um novo item deve ter entrada no manifesto, glifo 2D ou preview, fallback 3D, dimensoes coerentes e teste de integridade.

## Limites conhecidos

- Itens hospitalares novos usam geometria procedural ate a inclusao de modelos legais revisados.
- A importacao SH3F e deliberadamente assistida; nao ha importacao automatica de pacotes sem auditoria de licenca.
- Thumbnails automaticos dependem de um pipeline de renderizacao isolado ainda nao incorporado ao build.
