# Relatórios

## Visão geral

Módulo aditivo, sem tocar Dashboard, Ordens de Serviço, Inventário, Alertas,
Assistência Remota, agente Windows ou execução de scripts — só lê dados que já
existem, através dos mesmos repositórios/serviços usados por esses módulos
(`serviceOrderRepository`, `alertRepository`, `monitoringService`, etc.) mais
duas consultas novas e específicas (`server/src/repositories/reportRepository.js`)
para os dois domínios sem uma função de listagem pronta: execuções de script e
sessões de assistência remota.

Sete tipos de relatório: Mensal, Ordens de Serviço, SLA, Ativos, Avisos,
Scripts, Assistência Remota. Cada um tem preview na tela (cards de resumo +
tabela) e exportação CSV; impressão usa uma janela popup com HTML próprio
(mesmo padrão de `ServiceOrderDetailsModal.jsx`'s `printServiceOrder()`), não
o `@media print` global de `styles.css` (que é exclusivo da etiqueta de QR
Code e colidiria com uma impressão de página inteira).

## Camadas

`routes/reportRoutes.js` → `controllers/reportController.js` →
`services/reportService.js` → `repositories/reportRepository.js` +
`domain/reportBuilders.js` (uma função pura por tipo de relatório,
`buildXReport({dados}, filtros)` → `{summary, rows, warnings}`) +
`domain/reportCsv.js` (allowlist de colunas + serialização CSV). Mesmo padrão
de camadas do resto do backend.

## Permissões

Grupo `reports` em `shared/permissions.js`: `reports.view`, `reports.export`,
`reports.view_service_orders`, `reports.view_assets`, `reports.view_alerts`,
`reports.view_scripts`, `reports.view_remote_assistance`, `reports.manage`
(reservada para uma futura tela de histórico de exportações).

Cada tipo exige `reports.view` **mais** a permissão específica (SLA reaproveita
`reports.view_service_orders`, por expor a mesma granularidade de dado que o
relatório de Ordens de Serviço). Exportar CSV exige também `reports.export`,
concedida separadamente por ser o real vetor de saída em massa de dado do
sistema.

Por padrão (`roleDefaultPermissions.operator`), o operador recebe
`reports.view` + `view_service_orders`/`view_assets`/`view_alerts` (espelha o
que ele já enxerga hoje via `service_orders.view`/`inventory.view`/
`alerts.view`). Fica de fora por padrão: `reports.export` (vetor de
exfiltração), `reports.view_scripts` e `reports.view_remote_assistance` (o
operador não tem `scripts.view` nem nenhum `remote_assistance.*` por padrão
hoje) e `reports.manage`.

## Nunca inventar dado

Quando um campo não pode ser calculado, o relatório **omite a coluna** (quando
o conceito não existe para aquela entidade, como "preventiva relacionada" em
Avisos) ou mostra `null`/"indisponível" (quando o dado existe conceitualmente
mas está ausente naquele registro específico, como métricas de CPU/RAM/disco
em ativos cuja origem não coleta esses indicadores) — nunca `0`.

Casos confirmados como indisponíveis e documentados como tal, não como bug:

- **Avisos**: não existe vínculo entre alerta e plano preventivo em nenhuma
  tabela/migration — a coluna simplesmente não aparece.
- **Assistência Remota**: contagem de reconexões e qualidade média de vídeo
  só existem como métricas efêmeras no relay Redis durante uma sessão ao
  vivo, nunca persistidas após o fim da sessão.
- **SLA**: OS legadas sem `sla_due_at` calculado entram em
  `notApplicableCount`, um bucket separado que nunca é somado a
  `breached`/`resolved` nem entra no denominador de `closedCompliancePercent`.

## Segurança dos dados exportados

- **Allowlist, não blocklist** (`domain/reportCsv.js`, `REPORT_COLUMNS`): uma
  coluna nova em qualquer tabela de origem nasce excluída do CSV até alguém
  decidir incluí-la de propósito. A mesma allowlist (subconjunto no cliente,
  `reportUtils.js`, `REPORT_TABLE_COLUMNS`) alimenta a tabela de preview.
- **Scripts**: `stdout`/`stderr` são truncados a ~500 caracteres na própria
  consulta SQL (nunca os até 64KB completos buscados e cortados depois em
  JS); a coluna `script_content` (corpo integral do script) nunca é
  selecionada.
- **Assistência Remota**: a consulta usa `SELECT` com colunas nomeadas,
  nunca `SELECT *`, e nunca toca `remote_assistance_events` (frames/chat) nem
  as colunas de hash de token/credenciais TURN.
- **CSV**: delimitador `;` e BOM UTF-8 (compatibilidade com Excel pt-BR),
  quebra de linha CRLF, e neutralização de injeção de fórmula (célula de
  texto livre começando com `= + - @` recebe um apóstrofo antes de ser
  exportada).

## Endpoints

`GET /api/reports/<tipo>/preview` e `GET /api/reports/<tipo>/export.csv`, com
`<tipo>` em `monthly`, `service-orders`, `sla`, `assets`, `alerts`, `scripts`,
`remote-assistance`. Filtros por query string variam por tipo — só os que o
respectivo `buildXReport` de fato usa (ver `reportUtils.js` no cliente e
`reportBuilders.js` no servidor para a lista exata por tipo). Toda exportação
grava uma linha de auditoria em `report_exports` (tipo, formato, filtros,
usuário, quantidade de linhas) — a tabela existe desde já, a tela de consulta
desse histórico é um próximo passo natural, reservado por `reports.manage`.

## Fora de escopo desta versão

- Geração real de PDF (o popup de impressão cobre a necessidade sem
  dependência nova).
- Tela de histórico de exportações (a auditoria já é gravada, só falta a UI).
- Vínculo Alerta ↔ Preventiva (não existe no schema).
- Reconexões/qualidade média de Assistência Remota (nunca persistidas).
- Detalhamento de tempo por status de OS (exigiria andar
  `service_order_history` evento a evento).
- Histórico de troca de hardware em Ativos (hoje sempre vazio no sistema).
- Checklist como coluna por linha no relatório de OS (fica só como
  card-resumo agregado, para evitar N+1 consultas).

## Como testar

- Unidade (`npm run test --workspace server`): `domain/reportCsv.test.mjs`,
  `domain/reportBuilders.test.mjs` (bucket de SLA, derivação de origem,
  filtro por intervalo de data, sem dado sensível na allowlist).
- Integração (`npm run test:integration --workspace server`):
  `report-permissions.test.mjs` (matriz 401/403/200), `report-preview.test.mjs`,
  `report-sla-not-applicable.test.mjs`, `report-export-csv.test.mjs` (CSV sem
  nenhum token/frame, auditoria gravada).
- Cliente (`npm run test --workspace client`): `reportUtils.test.js`,
  `reportPrintHtml.test.js` (escapa HTML no popup de impressão),
  `ReportPreview.test.js` (allowlist de colunas nunca vaza chave sensível),
  `useReportData.test.js`.
