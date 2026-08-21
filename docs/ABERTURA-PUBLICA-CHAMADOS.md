# Abertura pública de chamados

Documento dedicado à tela pública `/abrir-chamado` (alias
`/solicitar-suporte`) e ao acompanhamento por token `/chamado/:token`.
Complementa a seção "Abertura publica de chamado" em
[FASE-2-ORDENS-SERVICO.md](FASE-2-ORDENS-SERVICO.md), que ficou
desatualizada num ponto importante (identificação da máquina) e foi
corrigida para apontar para cá.

## Objetivo

Permitir que qualquer pessoa, sem login e sem acesso ao painel
técnico, abra um chamado de suporte e depois acompanhe o andamento
desse chamado especificamente — sem nunca expor o inventário
completo, dados internos, identidade de técnicos ou qualquer OS além
da que a própria pessoa abriu.

## Fluxo (passo a passo)

1. **Formulário** (`PublicSupportForm.jsx`): título, categoria, tipo
   de problema, descrição, solicitante, contato (WhatsApp no modo
   Business, ramal no modo local), setor, urgência percebida e dados
   da máquina relacionada.
2. **Resumo antes de enviar** (`PublicSupportSummary.jsx`): revisão de
   tudo que foi preenchido, com opção de voltar e corrigir antes do
   envio real. Nada é gravado no banco até a confirmação neste passo.
3. **Envio** (`POST /api/public/service-orders`): cria a OS de
   verdade.
4. **Sucesso** (`PublicSupportSuccess.jsx`): mostra o número da OS,
   prioridade inicial e um link de acompanhamento copiável.
5. **Acompanhamento** (`/chamado/:token`, `PublicServiceOrderTracking.jsx`):
   consulta somente aquele chamado específico, sem autenticação, via
   o token da URL.

## Campos públicos suportados

Título, descrição, categoria, tipo de problema, nome do solicitante,
contato (WhatsApp/ramal), setor, urgência percebida (`low` / `normal`
/ `high` / `urgent` — ver `urgencyOptions` em
`publicSupportValidation.js`), e dados de identificação da máquina
relacionada (nome, patrimônio, localização).

**Importante**: a urgência percebida é só um sinal informativo enviado
pelo solicitante — ela nunca define a prioridade real da OS. A
prioridade é sempre calculada no backend, combinando a prioridade
padrão do tipo de problema selecionado com o histórico do ativo
identificado (quando há um), via `chooseHigherPriority` em
`server/src/domain/problemTypes.js`.

## Como a máquina é identificada

Quando o chamado é aberto a partir de um link já gerado pelo
instalador/agente do IT Guardian, a URL carrega um token JWT assinado
(`domain/publicMachineToken.js`, audience `"public-support-machine"`,
gerado no backend na ativação do coletor). O frontend chama
`GET /api/public/machine-context` com esse token; o backend resolve o
ativo real e devolve só `{id, name, hostname, environmentName}` — sem
IP, número de série, usuário logado ou qualquer outro dado do
inventário.

Se a pessoa marcar "problema é em outra máquina/equipamento", ela pode
digitar nome, patrimônio e localização livremente — mas esse texto
**nunca** vira um vínculo real com um ativo do inventário. Só um token
de máquina verificado pelo backend pode vincular um `assetId` real à
OS. Isso corrige uma vulnerabilidade que existia antes desta rodada:
o backend aceitava um `assetId` bruto enviado pelo próprio formulário
nesse cenário, sem nenhuma verificação — qualquer pessoa que soubesse
ou adivinhasse um UUID de ativo válido conseguia colocar uma máquina
que não era dela em manutenção. Agora `assetId` só pode vir de
`installedMachine?.id` (resolvido via token verificado), nunca de
texto do cliente.

## Como a OS é criada

`submitPublicServiceOrder` (`server/src/services/publicServiceOrderService.js`):

1. Verifica o campo honeypot (ver abaixo) antes de qualquer acesso ao
   banco.
2. Valida e corta (`trimString` + mapa `maxLengths`) todos os campos
   recebidos.
3. Resolve o tipo de problema e a prioridade inicial.
4. Chama `createServiceOrder(...)` com `source: "public_support_form"`
   e `assetId` só quando há um ativo verificado por token.
5. Aplica o template de checklist ativo para o tipo de problema
   (`applyChecklistTemplateOnCreate`), igual ao caminho interno de
   criação de OS.
6. Se há ativo vinculado, coloca o ativo em manutenção
   (`startMaintenanceForAsset`) e registra o evento no prontuário.
7. Gera um token de acompanhamento (ver abaixo) e devolve
   `{number, createdAt, priority, status, trackingToken}`.

## Como SLA e checklist são aplicados

- **SLA**: calculado do mesmo jeito que no painel interno
  (`calculateServiceOrderSla`, ver
  [SLA-ORDENS-DE-SERVICO.md](SLA-ORDENS-DE-SERVICO.md)), a partir da
  prioridade e das configurações de OS. O endpoint de acompanhamento
  expõe só `{status, dueAt}`, nunca os detalhes internos de cálculo.
- **Checklist**: se existe um template de checklist ativo para o tipo
  de problema selecionado, ele é aplicado automaticamente na criação —
  igual ao fluxo interno, sem nenhum caminho especial para o
  formulário público.

## Acompanhamento por token

`server/src/domain/publicServiceOrderTrackingToken.js` — JWT sem
estado, assinado com o mesmo segredo (`getJwtSecret()`) usado pelo
token de máquina, mas com uma **audience diferente**
(`"public-support-tracking"` vs. `"public-support-machine"`). Isso
impede que um token de máquina seja reaproveitado como token de
acompanhamento ou vice-versa, mesmo os dois sendo assinados com o
mesmo segredo. Expira em 180 dias. Não há revogação (não é necessária
para o payload mínimo exposto) e não há coluna nova no banco — o id
da OS vive só dentro do próprio token assinado.

`GET /api/public/service-orders/track/:token`
(`publicReadRateLimiter`) devolve somente:

```json
{
  "number": "OS-2026-000123",
  "title": "...",
  "status": "open",
  "priority": "medium",
  "createdAt": "...",
  "updatedAt": "...",
  "sla": { "status": "on_track", "dueAt": "..." }
}
```

O UUID interno da OS nunca é devolvido na resposta — ele só existe
dentro do payload assinado do token, que o backend decodifica
internamente.

## Proteção contra spam (honeypot)

Um campo de formulário invisível (`website`, ver `honeypotFieldName`
em `publicSupportValidation.js` e em
`publicServiceOrderService.js`) fica escondido via CSS (`clip`/
`position: absolute`, não `display: none` — alguns bots ignoram
`display: none`) e fora da navegação por teclado (`tabIndex={-1}`,
`aria-hidden`). Uma pessoa real nunca o preenche. Se ele vier
preenchido, o backend devolve um `201` com uma resposta no mesmo
formato de sucesso real — número de OS, data, prioridade e status —
mas **sem gravar nada no banco**. O número devolvido usa a mesma
função de formatação (`formatServiceOrderNumber`) usada para números
reais, mas com uma sequência fabricada, nunca a numeração real
(`nextServiceOrderNumber`, que faz `COUNT`/lock no banco, não é
chamada nesse caminho).

Isso soma-se à proteção já existente de rate limiting
(`publicReadRateLimiter`/`publicWriteRateLimiter`,
`server/src/middleware/rateLimitMiddleware.js`) em todas as rotas
públicas.

## O que é público vs. o que fica privado

**Público** (exposto pelas rotas `/api/public/*`): opções de
categoria/tipo de problema, contexto reduzido de uma única máquina
(quando identificada por token), criação de uma OS, e consulta de
status de uma única OS específica (quando identificada por token de
acompanhamento).

**Nunca exposto publicamente**: inventário completo, listagem de OS
sem token, dados de outros ativos, identidade ou permissões de
técnicos, IP/serial/usuário logado da máquina, UUID interno de
qualquer registro, dados de outras OS que não a do próprio token de
acompanhamento.

## Origem visível no painel interno

No painel técnico, `ServiceOrderDetailsModal.jsx` mostra um item
"Origem" na aba Geral quando `serviceOrder.source ===
"public_support_form"`, reaproveitando `getServiceOrderOriginLabel()`
(o mesmo rótulo já usado no card da OS). Contato, setor e ramal
informados no formulário público continuam visíveis nas notas da OS
(`serviceOrder.notes`), sem nenhuma coluna ou parsing novo.

## Limitações desta rodada

- Não há portal de cliente nem login público — o acompanhamento é só
  leitura, por token, de um único chamado por vez.
- Não há upload real de arquivo no formulário público (mesma
  limitação já documentada para anexos internos, ver
  [FASE-2-ORDENS-SERVICO.md](FASE-2-ORDENS-SERVICO.md)).
- O token de acompanhamento não pode ser revogado manualmente; expira
  sozinho em 180 dias.
- A urgência percebida é só informativa; não existe hoje um caminho
  para o solicitante contestar a prioridade calculada pelo backend.

## Roteiro de teste manual

1. Abrir `/abrir-chamado` sem nenhum parâmetro na URL — o formulário
   deve carregar normalmente, sem seção de máquina identificada.
2. Preencher os campos obrigatórios e marcar "problema é em outra
   máquina/equipamento", digitando um nome de máquina qualquer —
   confirmar que isso é só texto livre (não deve haver nenhum campo
   de UUID/ID no formulário).
3. Clicar em "Revisar e enviar" — conferir que a tela de resumo mostra
   os dados corretos e permite voltar.
4. Confirmar o envio — conferir a tela de sucesso, o número da OS e o
   botão de copiar link de acompanhamento.
5. Abrir o link copiado (`/chamado/:token`) numa aba anônima — deve
   mostrar status, título, prioridade e datas, sem exigir login.
6. No painel interno, abrir a OS criada e confirmar o badge "Origem:
   Portal público" na aba Geral.
7. Repetir o passo 2 usando um link com token de máquina válido
   (gerado pelo instalador) — confirmar que a máquina aparece como
   "identificada" e que a OS criada fica vinculada ao ativo real.
