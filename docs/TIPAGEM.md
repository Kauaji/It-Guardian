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
| Servidor | `server/src/domain/**` (regras puras, incluindo as subpastas `alerts`, `floorPlans`, `inventoryVisualMap`, `networkTopology`, `remoteAssistance`, `serviceOrders`, cada uma com seu `types.js`) | 75 |
| Servidor | `server/src/lib/**` | 7 |
| Servidor | `server/src/config/**` | 3 |
| Servidor | `server/src/security/**` | 4 |
| Servidor | `server/src/middleware/**` (agora com `authMiddleware.js`) | 7 |
| Servidor | `server/src/permissions.js` (reexporta `shared/permissions.js`, entra pelo fecho de imports) | 1 |
| Servidor | `server/src/database.js` (`query`, `withTransaction`, `withConnection` tipados) | 1 |
| Servidor | Nucleo de identidade/seguranca: `services/{authService,sessionService,mfaService,agentSigningService}.js`, `repositories/{userRepository,userSecurityRepository,authSessionRepository,logRepository}.js`, `jobs/dataRetention.js` | 8 |
| Servidor | `server/src/types/**/*.d.ts` (`express.d.ts`, `identity.d.ts`, `pg.d.ts`) | 3 |

Testes (`*.test.js`, `*.test.jsx`, `*.test.mjs`) ficam fora: eles usam mocks e dados parciais de
proposito.

### Ainda fora do escopo (proximas ondas)

| Arquivo | Motivo |
| --- | --- |
| `server/src/services/logoutService.js` | importa `remoteAssistanceService.js`, que arrasta ~290 erros (`remoteAssistanceRelay.js`, `remoteAssistanceRepository.js`, `services/remoteAssistance/*`, os repositorios de OS e `assetHistoryRepository.js`). `endSessionOnLogout` saiu de `authService.js` para este arquivo justamente para o nucleo de identidade nao herdar esse fecho |
| `server/src/repositories/**` (exceto os 4 acima), `server/src/services/**` (exceto os 4 acima), `server/src/controllers/**`, `server/src/routes/**`, `server/src/integrations/**`, `server/src/schema/**` | milhares de linhas de SQL/Express ainda sem `@typedef` de linha. O caminho e o mesmo do nucleo de identidade: `@typedef` da linha do banco, `/** @type {QueryResult<Linha>} */ const result = await query(...)` e o resultado mapeado como tipo |
| `client/src/components/**`, `client/src/hooks/**`, `client/src/App.jsx` | JSX + props de React; precisam de `jsx` no tsconfig e de tipos de props |

Ordem sugerida: repositorios pequenos que dependem so de `database.js` (agora tipado), os services deles, a
assistencia remota (`remoteAssistanceRelay`/`Repository` e `services/remoteAssistance/*`, que libera
`logoutService.js`), depois controllers/rotas; no cliente, `hooks/` e depois componentes folha.

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
- Tipos de pasta do dominio (`server/src/domain/<pasta>/types.js`): corpo cru de requisicao como
  `Record<string, unknown>` (ou typedef com so os campos lidos), entidade mapeada pelo repositorio
  (`ServiceOrder`, `Alert`, `FloorPlan`...) e linha crua do banco quando o dominio le colunas
  (`InfrastructureAssetRow`, `AlertRuleRow`; `NUMERIC`/`BIGINT` chegam como `string`).
- Banco: `server/src/database.js` expoe `QueryFn` e `query<Row>()`; `server/src/types/pg.d.ts` declara
  o minimo do driver `pg` (sem `@types/pg`). O formato da linha e do chamador:
  `/** @type {QueryResult<UserRow>} */ const result = await query(sql, params);`. Os tipos de identidade
  (`UserRow`, `User`, `AuthSession`, `RequestUser`...) ficam em `server/src/types/identity.d.ts` (aliases
  `type`, nao `interface`, para valerem como `Row extends Record<string, unknown>`). `rowCount` e
  `number | null`: use `(result.rowCount ?? 0) > 0`.
- `req.user` e `req.auth` sao declarados em `server/src/types/express.d.ts` (`RequestUser`, `RequestAuth`).
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
| `server/src/domain/serviceOrders/serviceOrderItems.js` | `normalizeServiceOrderItems([null, ...])` (corpo cru de criar/editar OS) lancava `TypeError` em `item.quantity` e virava 500 | entradas nulas sao descartadas (`serviceOrderPayload.test.mjs`) |
| `server/src/domain/inventoryVisualMap/visualMapPayload.js` | `parsePoints` devolvia o resultado cru de `JSON.parse`; `points_json` com texto JSON que nao e lista (`{}`, `5`, `null`) estourava em `.map` (500) em vez do 400 "Informe ao menos dois pontos" | resultado que nao e lista vira `[]` (`visualMapPayload.test.mjs`) |
| `server/src/domain/floorPlans/floorPlanPayload.js` | `normalizeEditorData`/`normalizeEditorChildren` lancavam `TypeError` (500) com `null` dentro de `floors`, `zones`, `objects`, `connectionPoints` ou `cableRoutes` do corpo cru; o validador, que ja tolerava `null`, nunca chegava a rodar | entradas nulas sao descartadas; sem andar valido cai no andar padrao (`floorPlanDomain.test.mjs`) |

Narrowing sem teste (so mudam um caso impossivel na pratica, uma corrida entre escrita e leitura):
`userRepository` devolve `null` em vez de `TypeError` se o usuario some entre o `UPDATE` e o `SELECT`
(`loadPublicUser`); `registerFirstAdmin` e `changeOwnPassword` respondem 403/401 em vez de `TypeError`
quando `findUserById` devolve `null` logo apos gravar.

### Achados que NAO foram alterados (decisao de produto/seguranca)

- `authMiddleware.requireAuth` monta `req.user` lendo `user.effectivePermissions`,
  `user.allowedEnvironmentIds`, `user.allowedGroupIds` e `user.allowedSegmentIds`, mas `userRepository`
  nunca preenche esses campos (nao ha colunas). Em runtime `effectivePermissions` fica `undefined`
  (`hasPermission` cai no calculo por papel) e os tres escopos viram sempre `[]`, de modo que
  `automationAccessScope.js` so enxerga `allowedClientIds` e o setor do usuario. Os campos estao
  declarados como opcionais em `identity.d.ts` com esse aviso: preenche-los muda autorizacao, entao
  fica para uma decisao de produto.

Ajustes menores sem mudanca de comportamento: `getCorsOrigins` ganhou `filter` com type predicate;
aritmetica com `Date` (`a - b`) virou `getTime()`; `productKey` e `integrationNormalization` trocaram
`.match(...)` possivelmente nulo por `?? []`.

## Limitacoes conhecidas

- O TypeScript instalado (`typescript@7`) valida so o que esta no `include`; um arquivo novo fora
  dele nao e checado ate ser adicionado.
- `import.meta.env` (Vite) vem de `vite/client` em `types`; o servidor nao usa `import.meta.env`.
- Os `@typedef` de resposta nao sao verificados contra o servidor. Um teste de contrato (por
  exemplo gerar os tipos a partir de um esquema compartilhado) seria o proximo passo.
