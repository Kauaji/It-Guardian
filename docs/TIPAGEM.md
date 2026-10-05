# Tipagem gradual com JSDoc e `tsc --noEmit`

O IT Guardian continua escrito em JavaScript. A checagem de tipos roda o compilador do TypeScript
em modo `checkJs`, lendo anotacoes JSDoc, sem gerar nenhum arquivo (`noEmit`). Nada muda no build
nem em runtime: o ganho e pegar erros de contrato (parametro errado, `null` nao tratado, campo que
nao existe) antes dos testes.

```bash
npm run typecheck   # tsc -p tsconfig.json --noEmit (tambem roda em `npm run check`)
```

## Estrategia

1. **`strict` desde o primeiro arquivo.** Os arquivos do escopo passam com `strict: true`
   (`noImplicitAny`, `strictNullChecks` etc.). Nao existe modo "frouxo" para depois apertar.
2. **Escopo crescente via `include`.** `tsconfig.json` lista so as pastas/arquivos que ja passam.
   Arquivos fora da lista nao sao verificados, mas **nao podem ser importados por um arquivo da
   lista**: o `tsc` segue os imports e acusaria os erros do arquivo importado. Por isso o escopo
   precisa ser fechado por imports (um modulo so entra depois de suas dependencias).
3. **Sem escapes baratos.** Nao ha `@ts-ignore`, `@ts-nocheck` nem `any` gratuito. Os dois unicos
   `any` (`RawRecord` e `firstValue` em `server/src/domain/integrationNormalization.js`) estao
   comentados: sao registros crus do OCS/Zabbix, cujo formato nao controlamos. Se um escape for
   realmente inevitavel, use `@ts-expect-error` com o motivo na mesma linha.
4. **Tipos descrevem o que o codigo le.** Os `@typedef` de resposta da API sao uma afirmacao do
   cliente sobre o servidor (nao ha validacao em runtime). Cada funcao de dominio fixa o seu retorno;
   `apiFetch<T>` devolve `Promise<T>` e o `T` e inferido pelo `@returns` da funcao que o chama.

## O que ja esta incluso

| Area | Escopo | Arquivos |
| --- | --- | --- |
| Cliente | `client/src/api/**` (`http.js`, 22 modulos por dominio e `types.js`) | 24 |
| Cliente | `client/src/permissions.js`, `client/src/authSession.js`, `client/src/utils/**`, `client/src/config/**` | 4 |
| Compartilhado | `shared/**` (`permissions.js`, `infrastructureHealth.js`) | 2 |
| Servidor | `server/src/domain/**` (regras puras) | 41 |
| Servidor | `server/src/lib/**` | 7 |
| Servidor | `server/src/config/**` | 1 |
| Servidor | `server/src/security/**` | 4 |
| Servidor | `server/src/middleware/**` | 6 |
| Servidor | `server/src/types/express.d.ts` (campos extras de `Request`) | 1 |

Testes (`*.test.js`, `*.test.jsx`, `*.test.mjs`) ficam fora: eles usam mocks e dados parciais de
proposito.

### Ainda fora do escopo (proximas ondas)

| Arquivo | Motivo |
| --- | --- |
| `server/src/middleware/authMiddleware.js` | importa `database.js`, `permissions.js` e `services/sessionService.js` |
| `server/src/domain/problemTypes.js`, `server/src/domain/serviceOrderAggregates.js` | importam `repositories/serviceOrderRepository.js` e `settingsRepository.js` (domain dependendo de repositorio) |
| `server/src/repositories/**`, `server/src/services/**`, `server/src/controllers/**`, `server/src/routes/**`, `server/src/database.js` | milhares de linhas de acesso a banco/Express; exigem tipar `query()` e o formato das linhas |
| `client/src/components/**`, `client/src/hooks/**`, `client/src/App.jsx` | JSX + props de React; precisam de `jsx` no tsconfig e de tipos de props |

Ordem sugerida: `database.js` (tipar `query<T>`), `repositories/` pequenos, `services/`, depois
`authMiddleware.js` e os dois arquivos de dominio acima; no cliente, `hooks/` e depois componentes
folha.

## Como ampliar o escopo

1. Escolha um arquivo cujos imports **ja estejam no escopo** (ou sejam so de `node_modules`).
2. Acrescente o caminho em `include` de `tsconfig.json` (e tire-o de `exclude`, se estiver la).
3. Rode `npm run typecheck` e corrija os erros. Receita rapida:
   - `TS7006`/`TS7031` (parametro implicito): anote `@param {tipo} nome`.
   - `TS2339` em `{}`: declare o formato com `@typedef` (ou `Record<string, unknown>` para corpo
     de requisicao nao confiavel) em vez de acessar campos de um objeto vazio.
   - `TS18047`/`TS2531` (`null`): trate o `null` (a correcao e o ponto da tipagem) ou refine com
     `typeof`/`!= null`.
   - Erros anexados a `Error` (`statusCode`, `code`): use `HttpErrorLike`
     (`server/src/lib/errors.js`) com `/** @type {HttpErrorLike} */ const error = new Error(...)`.
   - Funcoes que mudam o retorno conforme as opcoes: `@overload` (ex.: `text()` e `integer()` em
     `server/src/domain/agentPayload.js`).
4. Se o arquivo exigir reescrita grande para passar, **nao o inclua**: registre-o na tabela acima.

## Convencoes de anotacao

- Tipos compartilhados vivem em arquivos so de JSDoc (`client/src/api/types.js`,
  `server/src/domain/preventiveTypes.js`) e entram com a tag `@import`, que nao exporta nada:
  `/** @import { Device, EntityId } from "./types.js" */`.
- Formatos do servidor no cliente: `User`, `Session`, `SessionResponse`, `LoginResponse`, `Device`,
  `ServiceOrder`, `Alert`, `Sector`, `Segment` e os envelopes `*Response`/`*ListResponse`
  (`{ device }`, `{ serviceOrders }`, `{ alerts }`...). Campos nao usados ainda ficam de fora; promova-os a
  propriedade nomeada quando um componente passar a depender deles.
- Corpo de requisicao de escrita: `Payload` (`Record<string, unknown>`). Query string: `QueryParams`.
- Em servidor, middlewares usam `@import { NextFunction, Request, Response } from "express"`; o
  campo `req.requestId` e declarado em `server/src/types/express.d.ts`.
- Nao use `import { x } from "..."` dentro de comentarios que nao sejam `@import`: o
  `scripts/check-architecture.mjs` le essas linhas como imports reais.

## Bugs reais encontrados pela checagem

Alem de erros de anotacao, o `tsc` (ou a leitura que ele forcou) revelou defeitos de comportamento,
todos corrigidos com teste de regressao:

| Arquivo | Defeito | Correcao |
| --- | --- | --- |
| `shared/permissions.js` | `hasPermission(null, ...)` aceitava usuario nulo (`user?.role`), mas chamava `getEffectivePermissions(null)`, que lancava `TypeError` (o default `= {}` so vale para `undefined`) | `getEffectivePermissions` trata `null` como usuario sem papel |
| `server/src/domain/integrationNormalization.js` | `timestamp()` chamava `Date.parse(<numero>)`, que devolve `NaN`: os epochs `clock`/`r_clock` do Zabbix (convertidos para ms) viravam "agora", perdendo o horario real e o de resolucao dos problemas | numeros sao tratados como epoch em ms |
| `server/src/domain/partInventoryImport.js` | referencia numerica invalida em XML de NF-e (`&#x110000;`, `&#abc;`) lancava `RangeError` em `String.fromCodePoint` e virava erro 500 | codigo fora de 0..0x10FFFF vira texto vazio |
| `server/src/domain/hardwarePartInventory.js` | um `null` dentro das listas de inventario enviadas pelo agente (`disks: [null]`) lancava `TypeError` e derrubava a sincronizacao de pecas do ativo | elementos nulos sao descartados |

Ajustes menores sem mudanca de comportamento: `getCorsOrigins` ganhou `filter` com type predicate;
aritmetica com `Date` (`a - b`) virou `getTime()`; `productKey` e `integrationNormalization` trocaram
`.match(...)` possivelmente nulo por `?? []`.

## Limitacoes conhecidas

- O TypeScript instalado (`typescript@7`) valida so o que esta no `include`; um arquivo novo fora
  dele nao e checado ate ser adicionado.
- `import.meta.env` (Vite) vem de `vite/client` em `types`; o servidor nao usa `import.meta.env`.
- Os `@typedef` de resposta nao sao verificados contra o servidor. Um teste de contrato (por
  exemplo gerar os tipos a partir de um esquema compartilhado) seria o proximo passo.
