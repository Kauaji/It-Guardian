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

## Proximos passos tecnicos

1. Reforcar numeracao de OS com lock transacional/advisory lock quando houver multiplas instancias da API.
2. Criar comando/rotina segura para primeiro administrador em producao real.
3. Migrar manutencao e backup para backend.
4. Migrar abas/ambientes do inventario para backend.
5. Implementar coletor local.
6. Trocar `OCS_MODE=mock` por modo real em ambiente controlado.
7. Trocar `ZABBIX_MODE=mock` por modo real em ambiente controlado.
8. Trocar `PING_MODE=mock` por modo real em VPS/coletor.
