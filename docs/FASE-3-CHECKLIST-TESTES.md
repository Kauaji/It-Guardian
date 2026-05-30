# Fase 3 - Checklist de Testes

## Build

- [x] Dependencias ja presentes; `npm install` nao foi necessario nesta rodada.
- [x] Rodar `npm run build`. Validado em 30/05/2026.
- [x] Corrigir erros de import, sintaxe ou build. Nenhum erro restante no build final.
- [ ] Avaliar code splitting futuro: Vite ainda alerta que o chunk principal passa de 500 kB.

## Auditoria final - 30/05/2026

- [x] `npm run build` executado com sucesso.
- [x] Smoke test de API executado com banco `memory`, sem alterar dados reais.
- [x] Login validado para administrador, tecnico N1 e usuario sem permissao.
- [x] API retornou `401` sem token e `403` para usuario sem permissao em rotas protegidas.
- [x] Usuario inativo criado em teste foi bloqueado no login.
- [x] `GET /api/system-settings` e `PATCH /api/system-settings` respeitam permissao.
- [x] `GET /api/service-order-settings` respeita `service_orders.view`.
- [x] Usuario sem permissao recebe `403` em Configuracoes da OS.
- [x] Servico criado pela API aceitou valor e prioridade padrao.
- [x] Codigo duplicado de servico retornou `409`.
- [x] Duas OS criadas em sequencia receberam numeros diferentes gerados pelo backend.
- [x] OS criada com servico herdou valor e prioridade padrao do backend.
- [x] Peca/produto adicionado calculou `totalPartsValue`.
- [x] Mudanca para status final registrou `closed_at`.
- [x] Historico da OS foi retornado apos eventos do fluxo.
- [x] Exclusao de status em uso foi bloqueada.
- [x] Producao bloqueia `DATABASE_URL=memory`.
- [x] Producao bloqueia `JWT_SECRET` inseguro.

## Auditoria automatizada - 29/05/2026

- [x] `GET /api/health` respondeu `ok`.
- [x] Criar OS pela API.
- [x] Numero da OS foi gerado no backend: `OS-0005`.
- [x] Status inicial configurado aplicado pelo backend.
- [x] Tecnico, prioridade, ativo e item foram alterados pela API.
- [x] Status final registrou `closed_at`.
- [x] Historico da OS registrou eventos do fluxo.
- [x] Modo Local/Business foi lido e salvo via `/api/system-settings`, depois restaurado.
- [x] Usuario inativo recebeu bloqueio de login.
- [x] Usuario sem permissao recebeu `403` em inventario e usuarios.
- [x] Inventario respondeu dispositivos, segmentos, grupos, detalhe da maquina e rota publica de QR.
- [x] Ambiente de producao bloqueia `DATABASE_URL=memory`.
- [x] Ambiente de producao bloqueia `JWT_SECRET` inseguro.
- [x] Navegador abriu login, painel autenticado, Ordens de Servico, Configuracao da OS e Configuracoes Gerais sem erros de console.
- [x] OS temporarias da auditoria (`OS-0005` e `OS-0006`) foram removidas ao final do teste.
- [x] Rodada adicional corrigiu bug de criacao de OS no setor Geral: fallback agora grava `sector_id` e `sector_name` corretamente.
- [x] Rodada adicional validou modo Local/Business no navegador: Clientes oculto no Local e visivel no Business.
- [x] Rodada adicional validou usuario sem permissao no frontend: menus bloqueados ocultos e mensagem amigavel exibida.
- [x] Rodada adicional validou protecao do ultimo admin ativo em backend isolado em memoria.
- [x] Rodada de hardening de permissoes validou login admin, tecnico N1 e usuario sem permissao.
- [x] API retorna `401` sem token e `403` para usuario sem permissao em usuarios e inventario.
- [x] Cadastro publico fica bloqueado depois que ja existe administrador ativo.
- [x] Usuario inativo nao consegue logar.
- [x] Usuario comum com `admin.full` salvo indevidamente nao recebe permissao administrativa efetiva.
- [x] Permissoes de setor inativo nao sao herdadas.
- [x] Resposta de criacao de usuario gerenciado nao expoe `passwordHash`.
- [x] Seeds demo adicionais (`tecnico.n1`, `tecnico.n2`, `usuario.comum`, `sem.permissao`) ficam restritos a ambientes nao produtivos.
- [x] Rodada de configuracoes validou leitura de `/api/system-settings` por usuario autenticado.
- [x] Usuario sem `settings.system_mode` recebe `403` ao tentar alterar modo Local/Business.
- [x] Modo Local/Business persiste no backend apos alteracao e nova leitura.
- [x] Usuario com `service_orders.view` consegue ler `/api/service-order-settings`.
- [x] Usuario sem `service_orders.view` recebe `403` ao ler Configuracoes da OS.
- [x] Usuario sem `service_orders.settings` recebe `403` ao alterar Configuracoes da OS.
- [x] Prefixo, ano, mes, proximo numero, prioridade automatica, cores e visualizacao do painel salvam no backend.
- [x] Limite de 10 status foi validado pela API.
- [x] Backend mantem exatamente um status inicial e um status final.
- [x] Backend bloqueia exclusao/remocao de status que possui OS.
- [x] Servico criado pela API recebe codigo automatico `SRV-0001` e valor padrao.
- [x] Codigo duplicado de servico recebe `409`.
- [x] OS criada com servico usa codigo, valor e prioridade padrao vindos do backend.

## Login e permissoes

- [x] Login com `admin@itguardian.local`.
- [x] Login com tecnico N1.
- [x] Login com tecnico N2.
- [x] Login com usuario comum.
- [x] Login com usuario sem permissao.
- [x] Login com `tecnico.n1@itguardian.local`.
- [x] Usuario sem permissao ve mensagem amigavel ao acessar modulo bloqueado.
- [x] API bloqueia usuario sem permissao.
- [x] Admin acessa Admin.
- [x] Usuario comum nao acessa Admin pela API.
- [x] Nao permitir desativar o ultimo admin ativo.
- [x] Admin cria usuario, edita acesso e desativa usuario comum pela API.
- [x] Frontend considera Admin apenas para usuario `role=admin`/`isAdmin=true`.

## Modo Local

- [x] Alterar sistema para Modo Local.
- [x] Criar OS sem cliente.
- [x] OS usa setor.
- [x] Setor Geral funciona quando nao ha setor especifico.
- [x] Aba Clientes nao aparece nas Configuracoes da OS.
- [x] Cards/dados da OS retornam setor pela API.
- [ ] Filtro por setor funciona visualmente.

## Modo Business

- [x] Alterar sistema para Modo Business.
- [x] Aba Clientes aparece nas Configuracoes da OS.
- [x] Criar OS com cliente.
- [x] Cliente aparece nos dados/detalhes da OS pela API.
- [ ] Filtro por cliente validado visualmente.
- [ ] Tecnico com clientes permitidos ve apenas OS permitidas.

## Ordens de Servico

- [x] Criar OS.
- [x] Numero gerado no backend.
- [x] Formato do numero respeita configuracao atual do backend.
- [x] Selecionar servico.
- [x] Valor do servico e totais retornam pela API.
- [x] Alterar prioridade.
- [ ] Prioridade automatica com escalonamento por tempo.
- [x] Bloquear avanco sem tecnico quando a regra exige tecnico.
- [x] Mudar status.
- [x] Status final registra `closed_at`.
- [x] Historico registra eventos.
- [x] Adicionar peca/produto e calcular total de pecas.
- [x] Excluir OS pela API e limpar OS temporarias.
- [ ] Confirmacao visual de exclusao de OS.

## Configuracoes da OS

- [x] Abrir Configuracao da OS sem tela branca.
- [ ] Geral abre com accordions fechados.
- [x] Formato do numero salva pela API.
- [x] Prioridade automatica salva pela API.
- [x] Cores das prioridades salvam pela API.
- [x] Status limita a 10.
- [x] Status inicial unico validado pela API.
- [x] Status final unico validado pela API.
- [x] Aba Clientes fica condicionada ao modo Local/Business.
- [x] Servicos criam codigo automatico e bloqueiam codigo duplicado.
- [ ] Produtos/pecas salvam.
- [ ] Tecnicos salvam.
- [ ] Tipos de problema salvam.

## Inventario

- [x] Abas carregam no navegador.
- [x] Grupos carregam pela API.
- [x] Segmentos carregam pela API.
- [x] Nao organizadas aparece pela API.
- [ ] Backup aparece.
- [ ] Manutencao aparece quando existe maquina em manutencao.
- [x] Movimento de maquina entre segmentos funciona pela API e foi restaurado ao segmento original.
- [ ] Drag-and-drop visual move maquina.
- [ ] Drag para sidebar nao trava de forma perceptivel.
- [ ] Selecao multipla funciona.
- [x] Ficha/detalhe da maquina responde pela API.
- [ ] Historico aparece.
- [x] QR Code publico responde pela API.
- [ ] QR Code imprime visualmente.

## Configuracoes Gerais

- [ ] Usabilidade salva tamanho de fonte.
- [ ] Aparencia aplica preset.
- [ ] Modo escuro mantem contraste.
- [ ] Cores customizadas nao afetam tela publica de abertura de chamado.
- [x] Tela de login inicia em modo claro/padrao.
- [x] Modo do sistema salva no backend.
- [x] Usuario sem `settings.system_mode` nao altera modo do sistema.
- [x] Admin lista usuarios.
- [ ] Permissoes individuais ficam recolhidas por padrao.

## Pendencias manuais restantes

- Validar filtros visuais de setor/cliente no painel de OS.
- Validar drag-and-drop real com mouse no Inventario e drag para sidebar em uma sessao manual observada.
- Validar presets de Aparencia em modo claro/noturno com revisao visual completa.
- Validar salvamento visual de todas as abas de Configuracoes da OS, alem dos endpoints ja testados.
- Validar impressao real de QR Code e confirmacao visual de exclusao de OS.
