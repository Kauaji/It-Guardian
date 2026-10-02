# Performance do frontend: orcamento de bundle

O cliente (Vite + React) tem um orcamento de tamanho verificado por script. A ideia e
barrar regressoes silenciosas (uma dependencia nova, um import que puxa uma tela inteira
para o bundle inicial) antes de chegarem em producao.

## Como rodar

```bash
npm run build          # gera client/dist
npm run check:bundle   # node scripts/check-bundle-budget.mjs
```

`npm run check` ja executa os dois, nessa ordem. O script le `client/dist/assets` e
`client/dist/index.html`, mede o tamanho **gzip** de cada arquivo (1 kB = 1000 bytes, igual
ao relatorio do `vite build`) e sai com codigo 1 se algum limite for excedido. Um caminho
alternativo para o `dist` pode ser passado como primeiro argumento.

## Limites (kB gzip)

| Item | Medido (2026-10) | Limite |
| --- | --- | --- |
| Entrada `index-*.js` | 104,8 | 116 |
| `vendor-*.js` genericos carregados no inicio (react, router, dnd, icones, qrcode) | 104,0 (maior) | 115 cada |
| `vendor-charts` (recharts, pre-carregado pelo `index.html`) | 90,5 | 100 |
| `vendor-three` (three.js, so na planta 3D) | 166,4 | 183 |
| Chunk lazy qualquer (telas carregadas sob demanda) | 53,6 (FloorPlansModule) | 60 |
| JS inicial total (entrada + `modulepreload`) | 338,7 | 372 |
| CSS total (todos os `.css` emitidos) | 73,0 | 80 |

Os limites sao o valor medido com ~10% de folga. O pedido original sugeria tetos mais
frouxos (130 / 90 / 110 / 190 / 110); preferimos os apertados para que um aumento real
apareca. "Inicial" e tudo o que o `index.html` referencia (`<script>` e
`<link rel="modulepreload">`); o resto e considerado lazy.

## Quando o orcamento estourar

1. Descubra quem cresceu: `npm run build` imprime o tamanho de cada chunk.
2. Procure imports estaticos de telas pesadas (use `React.lazy`/`import()` como em
   `ServiceOrdersBoard`, `FloorPlansModule`) e dependencias grandes novas.
3. Se o crescimento for justificado, suba o limite em `scripts/check-bundle-budget.mjs`
   no mesmo commit e registre o motivo na mensagem do commit.
4. Se o bundle encolher bastante, desca o limite para manter a folga de ~10%.

## Observacoes

- `vendor-charts` e pre-carregado no `index.html`: recharts entra no custo da primeira
  carga mesmo para quem so ve telas sem grafico. Carregar o dashboard como chunk lazy
  (e tirar `recharts` do `modulepreload`) e a maior economia disponivel hoje.
- O CSS e dividido em `client/src/styles/*.css` (ver `docs/ARCHITECTURE.md`), mas o vite
  inlina os `@import`: o CSS emitido e identico ao do `styles.css` monolitico antigo.
