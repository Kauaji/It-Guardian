# Diario de bordo

Registro cronologico das entregas relevantes do IT Guardian. Toda consolidacao
funcional, mudanca operacional, migracao ou liberacao deve acrescentar uma
entrada neste arquivo com data, escopo, validacoes e pendencias conhecidas.

## 2026-07-29 - Beta centrada no coletor nativo

### Decisao e entrega

- coletor Windows nativo definido como unica dependencia obrigatoria no
  endpoint;
- OCS e Zabbix mantidos como adaptadores avancados, opcionais, somente leitura
  e desabilitados por padrao;
- instalador comum simplificado para solicitar apenas a chave e instalar o
  coletor nativo, sem baixar ou empacotar agentes externos;
- alertas do coletor cobrem heartbeat atrasado, CPU, memoria, disco alto e disco
  praticamente cheio;
- documentacao de cloud, beta, seguranca e integracoes alinhada ao
  comportamento real;
- decisao e limites registrados em `DECISAO-OCS-ZABBIX-BETA.md`.

### Pendencias conhecidas

- inventario completo de softwares, temperatura e atualizacao automatica foram
  adiados ate existirem politicas e fontes tecnicas confiaveis;
- assinatura do instalador e ensaio em maquina virtual limpa continuam
  requisitos antes da distribuicao publica.

## 2026-07-29 - Inventario real, avisos reais e execucao controlada pelo agente

### Entrega

- cards das maquinas coletadas pelo agente voltaram ao mesmo formato compacto
  do inventario, sem um bloco visual exclusivo para heartbeat;
- informacoes do coletor foram distribuidas entre Geral, Hardware e Rede; a aba
  separada `Agente IT Guardian` foi removida;
- Central de Avisos deixou de sintetizar dados de demonstracao e agora cria
  avisos somente a partir de maquinas reais do agente: heartbeat atrasado, CPU,
  memoria e disco;
- registros antigos com origem `mock` foram excluidos das consultas de avisos
  e sugestoes;
- criada fila persistente `agent_script_jobs`, vinculada ao ativo, enrollment,
  script cadastrado, log, validacao, preventiva e execucao automatizada;
- heartbeat autenticado entrega no maximo um trabalho pendente para a propria
  maquina e a nova rota autenticada recebe seu resultado;
- agente Windows 1.3.0 executa apenas scripts cadastrados dos tipos BAT, CMD e
  PowerShell, usando executaveis fixos do Windows, sem `shell: true`, com timeout,
  limite de saida, validacao de privilegio e remocao do arquivo temporario;
- sugestoes, preventivas manuais e agendas automatizadas passaram a enfileirar
  execucao real no agente, mantendo o cadastro e o resultado na mesma transacao;
- conclusao atualiza logs, validacoes, planos, agendas, auditoria global e o
  historico da respectiva maquina acessado pelo Inventario.

### Validacoes

- fluxo integrado de fila, entrega pelo heartbeat, retorno de resultado, log e
  historico da maquina aprovado sem executar um script operacional;
- suite completa, incluindo o roundtrip: 160 testes aprovados, 1 ignorado por
  exigir PostgreSQL real e 0 falhas;
- testes especificos do agente Windows aprovados;
- build de producao aprovado com 2.353 modulos transformados;
- lint sem avisos, verificacao arquitetural aprovada em 254 arquivos e
  `git diff --check` aprovado;
- compilacao do codigo C# do agente validada.

### Pendencias conhecidas

- reinstalar o coletor atualizado nas maquinas reais para habilitar o consumo
  da fila;
- validar em homologacao um script cadastrado de baixo risco antes de liberar
  rotinas operacionais;
- o teste automatizado usa resultado sintetico e nao executa BAT, CMD ou
  PowerShell no computador de desenvolvimento.

## 2026-07-29 - Finalizacao robusta e desinstalador executavel

### Escopo

- registro da inicializacao do coletor migrado para `schtasks.exe`;
- finalizacao passou a registrar diagnostico em
  `C:\ProgramData\ITGuardian\logs\install-finalize.log`;
- adicionado `ITGuardian-Uninstaller.exe` com icone e elevacao controlada para
  iniciar o desinstalador oficial do pacote.

## 2026-07-28 - Correcao dos argumentos opcionais do instalador Windows

### Escopo

- corrigida a falha de pos-instalacao causada pelo repasse de argumentos vazios
  de OCS/Zabbix ao `powershell.exe`;
- o instalador agora omite os parametros externos quando a organizacao utiliza
  somente o coletor nativo do IT Guardian;
- configuracoes externas parciais continuam bloqueadas para evitar uma
  instalacao inconsistente.

### Validacoes

- falha reproduzida com o mesmo comando do instalador e confirmada como
  `MissingArgument` para `OcsServerUrl`;
- teste de regressao do instalador atualizado;
- novo instalador recompilado e fluxo sem OCS/Zabbix validado.

## 2026-07-28 - Ativacao cloud independente de OCS e Zabbix

### Entrega

- ativacao por chave deixa de exigir infraestrutura OCS/Zabbix para cadastrar o
  coletor nativo do IT Guardian;
- instalador sempre configura o coletor, a tarefa SYSTEM, o indicador da
  bandeja e valida o primeiro heartbeat;
- OCS Inventory Agent e Zabbix Agent 2 permanecem incorporados ao pacote, mas
  so sao instalados quando a chave devolve os tres destinos completos;
- configuracao externa parcial continua bloqueada para evitar agentes
  instalados incorretamente;
- nenhuma URL ficticia, dependencia de Radmin ou servidor local improvisado foi
  introduzido.

### Validacoes executadas

- integracao confirmou ativacao `201`, token derivado, vaga e enrollment para
  chave sem monitoramento externo;
- integracao confirmou resposta explicita `monitoring.configured=false` e
  destinos nulos;
- teste de seguranca do instalador confirmou instalacao condicional dos agentes
  externos e ausencia de persistencia da chave;
- lint, verificacao de arquitetura, integracao completa e build de producao
  aprovados;
- parser do PowerShell aprovado para os scripts operacionais;
- Inno Setup 6.7.3 compilou o instalador 1.3.0 com sucesso;
- artefato final `ITGuardian-Collector-Setup.exe` com 24.078.647 bytes e
  SHA-256
  `0D0A999BE485920C0D0478A54908CBFB64575A2B37D48386FD9CF288081126E2`;
- deploy de producao Vercel `dpl_7H7qRHVn5YMzgie1JMjFJs9RJP32`
  confirmado como `READY` para o commit `bbd01b2`;
- `/api/health` confirmou API e banco em estado `ok`;
- chave real da organizacao validada em producao com `201`, token derivado,
  URL de suporte e ativacao da maquina, mesmo sem destinos OCS/Zabbix.

### Pendencias conhecidas

- OCS e Zabbix somente funcionarao depois que servidores centrais reais e
  acessiveis forem vinculados a chave;
- validar o novo executavel em uma VM Windows limpa e assina-lo antes da
  distribuicao publica.

## 2026-07-28 - Destinos OCS e Zabbix automaticos por chave

### Entrega

- migracao `007-product-key-monitoring` adiciona OCS, Zabbix passivo e Zabbix
  ativo a cada chave de produto;
- rota administrativa `PUT /api/product-keys/:id/monitoring` e CLI
  `product-key:monitoring` configuram chaves existentes;
- criacao de chave aceita os tres destinos em conjunto;
- ativacao devolve automaticamente os destinos pertencentes a chave, sem
  credenciais das APIs centrais;
- resposta de ativacao mantem o objeto `monitoring` e tambem entrega os tres
  destinos no nivel principal esperado pelo instalador Windows 1.3.0;
- destinos externos ausentes sao devolvidos como nulos; desde a correcao de
  compatibilidade posterior, isso nao bloqueia o coletor nativo;
- instalador 1.3.0 simplificado para solicitar somente a chave de produto;
- chave e destinos nao sao gravados no `config.json`; somente o token derivado
  e mantido com ACL restrita.

### Validacoes executadas

- teste de integracao original cobriu o bloqueio anterior; a entrada posterior
  registra a substituicao por monitoramento externo opcional;
- acesso a configuracao validado em `403` para operador e `200` para
  administrador;
- URL OCS com protocolo invalido rejeitada em `400`;
- duas chaves retornaram destinos diferentes sem vazamento entre organizacoes;
- teste do instalador confirmou ausencia da pagina manual de OCS/Zabbix e
  ausencia de persistencia da chave;
- `npm run lint` aprovado sem avisos;
- verificacao de arquitetura aprovada para 250 arquivos;
- servidor aprovado em 157 testes: 156 aprovados, nenhum reprovado e 1 teste de
  PostgreSQL real ignorado por depender de infraestrutura externa;
- build de producao aprovado com 2.353 modulos transformados;
- parser do PowerShell aprovado para os quatro scripts operacionais do pacote;
- `git diff --check` aprovado;
- Inno Setup compilou o instalador 1.3.0 com sucesso;
- artefato final `ITGuardian-Collector-Setup.exe` com 24.078.644 bytes e
  SHA-256
  `6D55BBEBE8D21CDB893E70D5F438D01733FB37D19F224B8C4786CDB1092CE000`.

### Pendencias conhecidas

- cadastrar os destinos reais OCS/Zabbix na chave que sera usada nesta
  organizacao;
- reinstalar e validar o pacote em uma VM Windows limpa depois da configuracao;
- assinar o instalador antes de uma distribuicao publica.

## 2026-07-28 - OCS e Zabbix incorporados ao instalador Windows

### Entrega

- instalador Windows atualizado para incluir OCS Inventory Agent 2.11.0.1 e
  Zabbix Agent 2 7.0.29 oficiais;
- build reproduzivel baixa os pacotes somente das distribuicoes oficiais,
  valida hashes SHA-256 fixos e exige assinaturas Authenticode dos publicadores
  FactorFX e Zabbix SIA;
- assistente instala os agentes com os destinos vinculados a chave;
- instalacao silenciosa configura os dois agentes como servicos automaticos e
  exige que ambos alcancem o estado `Running`;
- arquivo `monitoring-agents.json` registra versoes, destinos, servicos e
  propriedade da instalacao;
- desinstalador remove um agente externo somente quando o marcador confirma que
  ele foi instalado pelo IT Guardian, preservando instalacoes preexistentes;
- desinstalador disponivel em `Aplicativos instalados` e pelo atalho
  `Desinstalar IT Guardian` no menu Iniciar;
- binarios de terceiros permanecem fora do Git e sao incorporados somente ao
  artefato compilado.

### Validacoes executadas

- assinaturas e hashes dos pacotes oficiais aprovados;
- parser do PowerShell aprovado para os scripts do instalador;
- testes direcionados do instalador e seguranca aprovados;
- build de producao aprovado com 2.353 modulos transformados;
- `git diff --check` aprovado;
- Inno Setup 6.7.3 compilou o instalador 1.3.0 com os dois agentes incorporados;
- artefato final `ITGuardian-Collector-Setup.exe` com 24.078.918 bytes e
  SHA-256
  `D6CF7643E15048BB513657A39B8275AED3BB8428C74127FF04B9E20E0D86A728`;
- IT Guardian 1.2.0 desinstalado deste computador com codigo de saida `0`;
- registro de aplicativo, diretorio antigo, tarefas agendadas, processo e
  entrada de inicializacao automatica da versao 1.2.0 confirmados como ausentes.

### Pendencias conhecidas

- vincular os enderecos reais dos servidores OCS e Zabbix a chave;
- informar uma chave de produto valida para a reinstalacao;
- depois dessas configuracoes, instalar e executar o ensaio completo da 1.3.0
  neste computador;
- os servidores centrais OCS/Zabbix continuam sendo infraestrutura separada:
  o instalador distribui os agentes Windows, nao servidores ficticios locais.

## 2026-07-28 - Fontes reais e identidade nativa no Windows

### Entrega

- OCS e Zabbix restritos aos modos `real` e `disabled`, sem fallback mock e sem
  criacao de maquinas ficticias;
- snapshots mock antigos removidos na inicializacao e registros obsoletos de
  cada fonte removidos depois de uma sincronizacao real;
- seed historico de maquinas manuais removido do codigo e seed de outros dados
  demonstrativos condicionado a `ENABLE_DEMO_SEED=true` explicitamente;
- migracao remove somente os 13 ativos manuais exatos do seed historico,
  preservando ativos reais criados pelo usuario;
- sincronizacao automatica inicial e periodica de OCS/Zabbix em processos
  persistentes com acesso a LAN, com protecao contra execucoes sobrepostas;
- aplicativo nativo `ITGuardian.exe`, com produto, descricao e processo
  identificados como `IT Guardian`;
- tarefa `IT Guardian Collector` executada como SYSTEM na inicializacao e
  indicador visual iniciado com a sessao do Windows;
- icone oficial compartilhado pelo executavel, instalador, desinstalador,
  bandeja e atalho `Abrir chamado - IT Guardian`;
- indicador da bandeja estritamente visual, sem menu, execucao remota ou
  comandos para o usuario.

### Validacoes executadas

- parser do PowerShell aprovou gerador de icone, build, finalizacao,
  desinstalacao e diagnostico;
- testes de clientes confirmam que configuracoes mock legadas ficam
  desabilitadas e nao retornam dados inventados;
- teste de integracao confirma remocao de registros obsoletos apos
  sincronizacao real vazia;
- teste de seguranca do instalador cobre identidade nativa, tarefa de
  inicializacao, bandeja, icones e ausencia de execucao de shell.
- suite completa do servidor: 156 testes aprovados, 1 ignorado por exigir
  PostgreSQL real e 0 falhas;
- suite de integracao: 8 testes aprovados, 1 ignorado pelo mesmo requisito e
  0 falhas;
- cobertura selecionada: 89,66% de linhas, 64,17% de branches e 86,21% de
  funcoes;
- lint sem avisos, verificacao arquitetural aprovada em 248 arquivos,
  `git diff --check` aprovado e build de producao concluido com 2.353 modulos;
- Inno Setup 6.7.3 compilou o instalador final
  `ITGuardian-Collector-Setup.exe` sem avisos.

### Pendencias conhecidas

- configurar endpoints e credenciais reais de OCS e Zabbix; o `.env` deste
  computador ainda nao possui esses dados;
- executar a API/worker em uma maquina persistente que alcance os dois servicos
  na LAN;
- reinstalar o pacote Windows atualizado nas maquinas para aplicar executavel,
  tarefa, bandeja e icones novos;
- assinar o instalador antes de uma distribuicao publica.

## 2026-07-28 - Coletor cloud e licenciamento por chave

### Entrega

- chaves de produto armazenadas somente em hash, com expiracao, estado e limite
  transacional de computadores;
- ativacoes por fingerprint em hash, reinstalacao idempotente, revogacao de
  tokens e liberacao de vagas;
- endpoint publico e limitado para ativar o coletor, com rotas administrativas
  protegidas por autenticacao e papel de administrador;
- telemetria real ampliada com CPU, memoria, disco, fabricante, modelo e serial;
- instalador visual Inno Setup que pede somente a chave, cria tarefa SYSTEM,
  valida o primeiro heartbeat e instala o atalho de abertura de chamado;
- painel administrativo para chaves, ativacoes, OCS, Zabbix e download do
  instalador;
- arquitetura cloud/local e runbook operacional documentados.

### Validacoes executadas ate a consolidacao

- teste de ativacao invalida, inativa, expirada e acima do limite;
- reinstalacao da mesma maquina sem consumir nova vaga;
- concorrencia de duas maquinas pela ultima vaga sem ultrapassar o limite;
- acesso administrativo validado em `401`, `403` e `200`;
- token anterior revogado e heartbeat real persistido no inventario;
- instalador verificado contra persistencia da chave e execucao remota;
- suite completa do servidor: 154 testes aprovados, 1 ignorado por exigir
  PostgreSQL real e 0 falhas;
- suite de integracao: 7 testes aprovados, 1 ignorado pelo mesmo requisito e
  0 falhas;
- lint sem avisos, verificacao arquitetural aprovada em 248 arquivos e
  `git diff --check` aprovado;
- cinco scripts PowerShell do agente e do instalador aprovados pelo parser;
- build de producao aprovado, com 2.353 modulos transformados e saida da
  Vercel preparada;
- Inno Setup 6.7.3 instalado e instalador final compilado com sucesso.

### Pendencias conhecidas

- assinar o executavel e testar instalacao/desinstalacao em VM Windows limpa;
- publicar o instalador em HTTPS e configurar `VITE_COLLECTOR_INSTALLER_URL`;
- configurar PostgreSQL gerenciado e variaveis no deploy definitivo;
- executar OCS/Zabbix em processo com acesso a LAN quando forem habilitados.

## 2026-07-27 - Beta funcional consolidada na main

### Entrega

- perfil local oficial com Docker Compose, PostgreSQL persistente, API Express
  e frontend Nginx;
- inicializacao, diagnostico, parada, backup, restore e reset por scripts
  PowerShell;
- criacao segura do primeiro administrador e de enrollments para agentes;
- agente Windows com heartbeat e inventario basico, sem execucao remota;
- estado online/offline integrado ao inventario e vinculacao de ativos no mapa
  2D;
- OCS e Zabbix mantidos como integracoes opcionais e desabilitadas por padrao;
- documentacao da beta, instalacao, agente, seguranca, testes em maquinas reais
  e checklist de liberacao.

### Commits consolidados

- `165783a` - adiciona modo local de instalacao do IT Guardian;
- `c391bb3` - integra agente Windows ao inventario real;
- `6cd8ec6` - cobre inventario e heartbeat do agente;
- `24f497e` - documenta instalacao local e agente Windows;
- `fa12f3d` - adiciona integracoes opcionais OCS e Zabbix;
- `c7e7b6a` - prepara runtime da beta funcional;
- `d487c21` - consolida operacao do agente Windows;
- `402eba9` - documenta instalacao e validacao da beta.

### Validacoes

- testes unitarios: 149 aprovados e 1 ignorado;
- testes de integracao: 4 aprovados e 1 ignorado;
- lint aprovado;
- build de producao aprovado;
- verificacao arquitetural aprovada em 237 arquivos;
- 19 scripts PowerShell validados por parser;
- smoke test realizado com Docker e PostgreSQL reais.

### Pendencias conhecidas

- concluir o ensaio completo com um segundo computador Windows;
- configurar HTTPS ou VPN antes de qualquer exposicao fora da LAN;
- validar restore e recuperacao de desastre no ambiente definitivo;
- habilitar OCS ou Zabbix somente em ambiente de homologacao.

## 2026-07-29 - Correcao do limite de conexoes na Vercel

### Incidente

- login e demais rotas da API retornavam `500` em producao;
- os logs da Vercel confirmaram `EMAXCONN`, com o limite de 200 conexoes do
  PostgreSQL esgotado.

### Correcao

- pool limitado a uma conexao por instancia serverless, inclusive quando uma
  configuracao antiga de `DB_POOL_MAX` solicitar um valor maior;
- conexoes ociosas passam a ser liberadas em cinco segundos na Vercel;
- `allowExitOnIdle` habilitado em serverless;
- servidor tradicional preserva o pool padrao de dez conexoes e continua
  aceitando configuracao explicita.

### Validacoes

- 165 testes do servidor aprovados e 1 ignorado;
- lint aprovado;
- build de producao aprovado;
- `git diff --check` aprovado.

