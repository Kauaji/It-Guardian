# Fase 3 - Preparacao para Implementacao Real

## Estado atual

O IT Guardian ja tem base de backend para Fase 3:

- Express API centralizada.
- Bootstrap idempotente de tabelas.
- PostgreSQL por `DATABASE_URL`.
- Bloqueio de `DATABASE_URL=memory` em ambiente de producao.
- JWT com validacao de segredo seguro em producao.
- Permissoes em backend para inventario, OS e administracao.
- OS usando backend como fonte principal de numero, status, prioridade e historico.
- Endpoints explicitos de OS para prioridade, tecnico, ativo, itens, configuracoes e status.
- Numeracao de OS protegida por `UNIQUE` no banco e fila interna no processo da API.
- Modo Local/Business persistido em backend.
- Configuracoes de regra da OS persistidas no backend.
- Configuracoes da OS podem ser lidas por usuarios com `service_orders.view`, enquanto alteracoes exigem `service_orders.settings`.
- Status de OS sao persistidos em `service_order_statuses`, limitados a 10 e normalizados para exatamente um inicial e um final.
- O backend bloqueia remocao de status que ainda possui OS vinculada.
- Servicos sao persistidos em `service_catalog`, geram codigo automatico `SRV-0001` quando necessario, aceitam valor padrao e bloqueiam codigo duplicado.
- Usuarios, setores e permissoes com bloqueio no backend.
- Seeds demo restritos a ambientes nao produtivos; producao nao recebe usuarios/senhas ficticias automaticamente.
- Cadastro publico cria apenas o primeiro administrador; depois disso, novos usuarios passam por rotas administrativas.
- Permissoes canonicas usam `inventory.print_qrcode`, `service_orders.finish` e `settings.view`, com aliases legados aceitos somente para compatibilidade.
- Permissoes administrativas (`admin.*`) nao sao efetivas para usuarios comuns, mesmo se forem gravadas por engano.
- Setores inativos nao emprestam permissoes herdadas aos usuarios.

## Avisos - inteligencia operacional incremental - 08/06/2026

Foi adicionada uma camada incremental de inteligencia operacional no modulo de Avisos, sem integrar OCS, Zabbix real, ping real, agente ou coletor.

Implementado:

- Backend enriquece avisos com categoria, impacto operacional, causa provavel, acao recomendada, checklist sugerido, tendencia, nivel de confianca, score de recorrencia e motivo da prioridade.
- Backend calcula correlacoes simples entre avisos ativos por tipo, grupo e segmento do Inventario.
- Backend expõe comentarios internos de avisos por API.
- Tabela `alert_comments` criada no bootstrap do banco.
- Novos endpoints:
  - `GET /api/alerts/correlations`
  - `GET /api/alerts/insights`
  - `GET /api/alerts/:id/comments`
  - `POST /api/alerts/:id/comments`
- Permissoes adicionadas:
  - `alerts.comment`
  - `alerts.silence`
- Frontend exibe avisos correlacionados, motivo da prioridade, checklist sugerido, reincidencia, possivel falso positivo, previsao simples de capacidade e comentarios internos.

Limites atuais:

- Correlacao ainda e calculada em memoria com base nos avisos ativos e na estrutura atual do Inventario.
- Previsao de capacidade e apenas indicativa; quando nao ha historico suficiente, o sistema informa essa limitacao.
- Regras criadas automaticamente a partir de aviso e perfis por cliente/setor ficaram preparados conceitualmente, mas nao foram implementados nesta rodada.

## Avisos - planos preventivos - 08/06/2026

Foi criada a base de Preventivas dentro do modulo de Avisos, mantendo a regra de que nenhum script real e executado nesta etapa.

Implementado:

- Nova area visual "Preventivas" dentro de Avisos.
- Cards de sugestao continuam compactos e mostram contador de recorrencia quando o mesmo problema se repete.
- Sugestoes sao ordenadas por urgencia, considerando prioridade, recorrencia e data.
- Botao de scripts disponiveis nos cards recomenda scripts ativos por tipo de aviso, categoria, tags, tipo de problema, tipo de maquina, grupo e segmento.
- Recusar sugestao remove o card da fila ativa e silencia a mesma sugestao por periodo configuravel.
- Configuracoes de Avisos passam a persistir:
  - `rejectedAlertSilenceHours`
  - `recurrenceCounterResetHours`
- Backend cria tabelas de planos preventivos:
  - `preventive_plans`
  - `preventive_plan_scripts`
  - `preventive_plan_assets`
- Novos endpoints:
  - `GET /api/preventive-plans`
  - `POST /api/preventive-plans`
  - `GET /api/preventive-plans/:id`
  - `POST /api/preventive-plans/:id/prepare`
  - `GET /api/preventive-plans/:id/logs`
- Permissoes adicionadas:
  - `preventive_plans.view`
  - `preventive_plans.create`
  - `preventive_plans.prepare`
- Criacao de preventiva valida maquinas selecionadas, scripts ativos e reconhecimento de risco alto/critico.
- Ao criar plano preventivo, o backend registra logs simulados por maquina e eventos em `asset_history`.
- A tela de Preventivas agrupa maquinas por aba/ambiente, grupo e segmento para facilitar selecao por escopo.
- A criacao de Preventivas foi reorganizada em etapas: selecionar maquinas, selecionar verificacoes/scripts e revisar antes de registrar.
- A interface mostra aviso explicito de que scripts sao apenas referencia/roteiro nesta versao.
- Antes de confirmar, um modal de revisao exibe nome do plano, observacao, maquinas, verificacoes, riscos e o aviso de que nenhum comando sera executado.
- Status tecnicos continuam internos, mas a interface usa labels amigaveis como "Preparado", "Registrado" e "Concluido manualmente".
- Plano preventivo nao cria Ordem de Servico automaticamente.
- Apos registrar um plano, a interface mostra um resumo e oferece a acao opcional "Criar OS preventiva".
- O backend bloqueia duplicidade: um plano com OS vinculada nao cria outra OS preventiva.
- Vinculo persistido entre plano e OS:
  - `preventive_plans.service_order_id`
  - `service_orders.preventive_plan_id`
- Novo endpoint para transformar plano em OS preventiva:
  - `POST /api/preventive-plans/:id/service-order`
- A OS preventiva criada entra no painel normal de Ordens de Servico, com origem "Plano Preventivo", categoria preventiva e historico de origem.
- O historico dos ativos registra quando um plano preventivo gera OS preventiva.
- A tela de Preventivas agora mostra uma visao operacional por maquina, indicando ultima preventiva registrada, proxima data sugerida e status visual.
- As maquinas sao classificadas em "Sem preventiva", "Preventiva vencida", "Preventiva em dia", "Critica", "Em manutencao" e "Backup" conforme planos existentes, avisos ativos e estado do inventario.
- As Configuracoes de Avisos passaram a persistir `preventiveDueDays`, usado para calcular quando uma maquina precisa de nova preventiva. O padrao atual e 180 dias.
- Foram adicionados cards de resumo e filtros por status para facilitar identificar maquinas que precisam de preventiva.
- O historico de planos preventivos passou a exibir detalhes expansivos com maquinas, verificacoes/scripts e observacoes do plano.

Limites atuais:

- Scripts continuam sendo somente cadastro, recomendacao e simulacao; nenhum comando e executado.
- Execucao real de scripts deve ficar para uma fase futura com agente/coletor seguro.
- Validacao manual de permissoes especificas de Preventivas ainda deve ser feita com usuarios reais.
- O teste automatizado validou build e renderizacao basica; a criacao completa de preventiva, a criacao opcional de OS e a leitura visual dos novos filtros ainda precisam de teste manual assistido.

## Avisos - scripts seguros e UX de Preventivas - 12/06/2026

Foi reforcada a estrutura de scripts/BATs como cadastro seguro e nao executavel, mantendo o backend como fonte de verdade.

Implementado:

- `maintenance_scripts` recebeu metadados para recomendacao contextual: `tags`, `supported_variables`, `related_alert_types`, `related_problem_types`, `recommended_for_categories`, `requires_logged_user`, `requires_admin`, `safe_preview` e `variable_validation_status`.
- Backend reconhece somente variaveis permitidas no texto do script: `{{CURRENT_USER}}`, `{{USER_PROFILE}}`, `{{TEMP_DIR}}`, `{{HOSTNAME}}`, `{{ASSET_NAME}}`, `{{ASSET_IP}}`, `{{OS_DRIVE}}` e `{{PROGRAM_DATA}}`.
- Variaveis desconhecidas bloqueiam cadastro/edicao do script com erro 400.
- A analise de script retorna variaveis permitidas, variaveis usadas, variaveis desconhecidas e previa segura textual.
- Sugestoes de OS separam scripts recomendados para o aviso e outros scripts disponiveis.
- A recomendacao considera tags, tipo de aviso, tipo de problema, categoria, resumo do script, maquina, grupo e segmento.
- Configuracoes de Avisos abrem com todas as secoes recolhidas.
- A Etapa 2 das Preventivas fica recolhida ate haver ao menos uma maquina selecionada.
- A lista de maquinas para Preventivas foi compactada para destacar nome da maquina e alerta critico, sem checkbox visual.
- Cards de sugestao foram padronizados com altura fixa e titulo limitado a duas linhas.

Limites atuais:

- Nenhum comando real e executado pelo servidor, navegador ou frontend.
- As variaveis sao apenas validadas e exibidas em previa textual. A resolucao real depende de um agente seguro futuro.
- O fluxo ainda exige validacao visual manual completa no navegador autenticado.

## Avisos - automacao preventiva recorrente - 13/06/2026

Foi adicionada a base de Automacao Preventiva dentro do modulo de Avisos, mantendo a regra de seguranca de que nenhum comando real e executado sem agente seguro.

Implementado:

- Correcao da listagem de sugestoes de OS para remover `LEFT JOIN LATERAL`, evitando falha no `pg-mem`.
- Backend cria tabelas de automacao preventiva:
  - `preventive_automation_plans`
  - `preventive_automation_overrides`
  - `preventive_automation_runs`
- Novos endpoints:
  - `GET /api/preventive-automation-plans`
  - `POST /api/preventive-automation-plans`
  - `GET /api/preventive-automation-plans/:id`
  - `PATCH /api/preventive-automation-plans/:id`
  - `DELETE /api/preventive-automation-plans/:id`
  - `POST /api/preventive-automation-plans/:id/prepare`
- Permissoes adicionadas:
  - `preventive_automation.view`
  - `preventive_automation.create`
  - `preventive_automation.update`
  - `preventive_automation.disable`
  - `preventive_automation.run_prepare`
- A interface Avisos > Automacao Preventiva permite listar, criar, editar, desativar e preparar planos.
- Planos aceitam recorrencia diaria, semanal, quinzenal, mensal ou personalizada em dias.
- Planos aceitam escopo por todas as maquinas, maquina, segmento ou grupo.
- Recorrencias personalizadas podem ser definidas por maquina ou segmento.
- A preparacao cria registros em `preventive_automation_runs`, registra historico em `asset_history` e grava log geral, sem executar comandos.
- A UI informa que a execucao real depende de agente seguro instalado na maquina.

Limites atuais:

- A automacao prepara e registra rotinas; nao executa BAT/CMD/PowerShell.
- Escopo por aba/ambiente ficou fora desta rodada porque as abas ainda nao estao consolidadas como fonte de verdade no backend atual.
- A proxima execucao prevista e calculada de forma simples com base na recorrencia e no horario preferencial.
- A validacao visual completa ainda precisa ser feita com usuario autenticado.

## Auditoria geral de código - 02/06/2026

Foi criada a documentação `docs/AUDITORIA-GERAL-CODIGO.md` com a rodada de estabilização pós-migração.

Pontos confirmados:

- Build de produção executado com sucesso.
- Sintaxe dos arquivos rastreados do backend validada com `node --check`.
- Textos visíveis em `client/src` revisados para PT-BR nos pontos encontrados pela varredura.
- Formulário de criação de OS ajustado para usar checkbox compacto em “É uma OS de terceiros?”.
- Carregamento de técnicos/clientes do modal de criação de OS ajustado para evitar refetch causado por dependência instável.

Pendências mantidas para próxima etapa:

- Code splitting do frontend, pois o bundle principal ainda passa de 500 kB.
- Consolidação de estados locais remanescentes do Inventário.
- Validação visual manual de fluxos bloqueados por diálogo nativo ou pelo cliente do navegador.

## O que ainda nao e implementacao real

- OCS ainda usa mock.
- Zabbix ainda usa mock.
- Ping real ainda nao roda no Vercel.
- Coletor por cliente ainda nao existe.
- Preventivas ainda nao executam scripts reais; registram apenas preparacao/simulacao.
- Abas/ambientes do inventario ainda dependem parcialmente de estado local.
- Manutencao/backup ainda precisam ser consolidados totalmente no backend.
- Preferencias visuais continuam no frontend por decisao de baixo risco.

## Auditoria final - 29/05/2026

Validacoes executadas contra a API local:

- `GET /api/health` respondeu `ok`.
- Criacao de OS gerou numero no backend: `OS-0005`.
- Status inicial aplicado pelo backend: `open`.
- Troca para status final registrou `closed_at`.
- Historico da OS registrou 7 eventos no fluxo auditado.
- Item de produto/peca foi gravado na OS.
- Modo Local/Business foi lido e alterado via `/api/system-settings`, depois restaurado.
- Usuario inativo recebeu bloqueio de login `401`.
- Usuario sem permissao recebeu `403` em inventario e usuarios.
- Inventario retornou 47 dispositivos, 6 segmentos e 3 grupos no smoke test.
- Detalhe de dispositivo e rota publica de QR responderam corretamente.
- Browser local abriu login, painel autenticado, Ordens de Servico, Configuracao da OS e Configuracoes Gerais sem erros de console.
- OS temporarias da auditoria foram removidas ao final do teste.

## Hardening de usuarios e permissoes - 30/05/2026

Validacoes executadas contra API local em memoria:

- Login de administrador, tecnico N1 e usuario sem permissao.
- `GET /api/users` retorna `401` sem token.
- Usuario sem permissao recebe `403` em `/api/users` e `/api/devices`.
- Tecnico N1 herda `service_orders.view` pelo setor.
- Usuario gerenciado criado por admin retorna objeto publico sem `passwordHash`.
- Usuario comum com `admin.full` individual nao ganha acesso administrativo efetivo.
- Setor inativo nao concede permissao herdada.
- Usuario inativo nao consegue logar.
- Administrador auxiliar pode ser desativado.
- Ultimo administrador ativo nao pode ser desativado.

## Consolidacao de configuracoes - 30/05/2026

Validacoes executadas contra API local em memoria:

- `GET /api/system-settings` disponivel para usuario autenticado.
- `PATCH /api/system-settings` exige `settings.system_mode`.
- Modo Local/Business persistiu apos nova leitura.
- `GET /api/service-order-settings` disponivel para usuario com `service_orders.view`.
- `PATCH /api/service-order-settings` exige `service_orders.settings`.
- Prefixo, ano, mes, proximo numero, prioridade automatica, cores de prioridade e layout do painel persistem no backend.
- Status de OS respeitam limite de 10.
- Troca de status inicial/final manteve exatamente um papel ativo de cada tipo.
- Remocao de status em uso foi bloqueada em `DELETE /api/service-order-statuses/:id` e tambem via `PATCH /api/service-order-settings`.
- Servico criado sem codigo recebeu codigo automatico e valor padrao.
- Codigo duplicado de servico foi bloqueado.
- Nova OS usou numero, status inicial, servico, valor e prioridade padrao definidos no backend.

## Auditoria final pos-migracao - 30/05/2026

Rodada executada antes de publicar a branch:

- `npm run build` passou sem erro.
- Vite manteve apenas o aviso conhecido de chunk principal acima de 500 kB.
- Smoke test de API validou login admin, tecnico N1 e usuario sem permissao.
- Rotas protegidas retornaram `401` sem token e `403` sem permissao.
- Usuario inativo foi bloqueado no login.
- Modo Local/Business e Configuracoes da OS foram lidos/salvos via API com permissao correta.
- Servico criado pela API manteve codigo unico, valor padrao e prioridade padrao.
- Duas OS criadas em sequencia receberam numeros diferentes gerados pelo backend.
- OS com servico herdou valor e prioridade do backend.
- Pecas/produtos atualizaram total de pecas.
- Status final registrou `closed_at` e historico foi retornado pela API.
- Remocao de status em uso foi bloqueada.
- Producao bloqueou `DATABASE_URL=memory` e `JWT_SECRET` inseguro.

Resultado: a Fase 3 esta pronta como base tecnica para a proxima etapa,
mantendo OS, usuarios, setores, permissoes e configuracoes de regra no backend.
As pendencias restantes estao concentradas em manutencao/Backup e
abas/ambientes do Inventario.

## Preparacao recomendada

### Banco

- Usar PostgreSQL real em todos os ambientes persistentes.
- Manter seed demo restrito a desenvolvimento/demo e criar fluxo formal para primeiro admin em producao real.
- Criar migration formal quando sair do MVP.
- Revisar indices para:
  - `service_orders.number`
  - `service_orders.status`
  - `service_orders.sector_id`
  - `service_orders.environment_id`
  - `service_order_history.service_order_id`
  - `device_metadata.device_id`

### Seguranca

- Definir `JWT_SECRET` longo e unico por ambiente.
- Usar HTTPS em producao.
- Manter CORS restrito a dominios conhecidos.
- Validar permissoes no backend em todas as rotas mutaveis.
- Evitar seeds demo em producao real.

### Coletor

Arquitetura recomendada para Business:

```txt
Cliente
  -> coletor local dentro da rede
  -> ping/OCS/Zabbix internos
  -> envio seguro para API central
  -> IT Guardian central
```

Evitar VPN geral entre clientes. O coletor reduz exposicao e limita acesso a rede interna de cada cliente.

## Checklist de estabilizacao

- `npm run build` passa.
- Login admin passa.
- Usuario sem permissao nao acessa modulos bloqueados.
- OS cria numero no backend.
- OS respeita status inicial/final configurado.
- OS registra historico.
- Modo Local oculta clientes na configuracao de OS.
- Modo Business mostra clientes.
- Inventario abre, move maquinas e exibe ficha.
- Configuracoes Gerais abrem sem tela branca.
- Tema claro/noturno nao quebra contraste.

## Reforco de logs e validacao de scripts

- Scripts selecionados a partir de Sugestoes de OS agora registram uso seguro no backend.
- Nenhum BAT, CMD, PowerShell ou comando de navegador e executado nesta fase.
- O backend cria registro em `script_execution_logs` e ciclo em `script_validation_runs`.
- A Sugestao de OS recebe indicador visual de validacao por script.
- Logs com erro podem ser marcados como revisados ou receber acao corretiva registrada.
- A acao "Aplicar solucao sugerida" apenas registra a intencao corretiva; nao executa comando.
- O tempo de validacao fica em `scriptValidationWindowMinutes` nas Configuracoes de Avisos.
- A reavaliacao usa o estado do aviso: se o problema nao voltar, a sugestao pode ser validada; se persistir, a validacao falha.

## Proximos passos tecnicos

1. Reforcar numeracao de OS com lock transacional/advisory lock quando houver multiplas instancias da API.
2. Criar comando/rotina segura para primeiro administrador em producao real.
3. Migrar manutencao e backup para backend.
4. Migrar abas/ambientes do inventario para backend.
5. Implementar coletor local.
6. Trocar `OCS_MODE=mock` por modo real em ambiente controlado.
7. Trocar `ZABBIX_MODE=mock` por modo real em ambiente controlado.
8. Trocar `PING_MODE=mock` por modo real em VPS/coletor.
