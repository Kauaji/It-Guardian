# Diario de bordo

Registro cronologico das entregas relevantes do IT Guardian. Toda consolidacao
funcional, mudanca operacional, migracao ou liberacao deve acrescentar uma
entrada neste arquivo com data, escopo, validacoes e pendencias conhecidas.

## 2026-08-03 - Instalador 1.6.2, reparo visivel e download confiavel

### Correcao da finalizacao

- o modo `Instalar ou reparar o IT Guardian` passou a ser exibido antes da
  ativacao e tambem reconhece residuos de uma instalacao interrompida;
- uma configuracao valida continua sendo preservada no reparo; instalacoes
  parciais solicitam a chave novamente e reconstroem a configuracao;
- o heartbeat inicial ganhou tres tentativas e deixou de cancelar uma
  instalacao estruturalmente valida por indisponibilidade momentanea da rede;
- a tarefa resiliente do Windows permanece responsavel pelas novas tentativas;
- o log de diagnostico agora tambem e preservado em
  `C:\ProgramData\ITGuardian-install-finalize.log`, fora da pasta removida pelo
  rollback do instalador.

### Publicacao e validacao

- coletor e instalador alinhados na versao `1.6.2`;
- artefato `ITGuardian-Collector-Setup.exe` gerado com 2.099.090 bytes e
  SHA-256 `ED07BDD7B7356B8876A72F7EC50ABC61B664FA232310B4A5168AB29C74C47876`;
- testes de seguranca do instalador: 3/3 aprovados;
- `npm run lint`, `npm run build` e `git diff --check` aprovados;
- a interface aponta para o release versionado do instalador quando nenhuma
  URL externa for configurada.

### Pendencia conhecida

- o executavel ainda nao possui assinatura Authenticode; a assinatura de
  codigo continua obrigatoria antes de uma distribuicao comercial ampla.

## 2026-08-02 - Hardening profissional e recuperacao da tela branca

### Estabilidade do frontend e Vercel

- identificada a causa da tela branca: HTML/main bundle antigo referenciando um
  chunk lazy removido por um deploy mais novo;
- navegacoes SPA passaram a usar `no-store` e assets com hash mantem cache
  imutavel;
- falha de import dinamico faz uma unica recarga com cache busting, sem loop;
- um Error Boundary exibe recuperacao profissional em vez de deixar `#root`
  vazio quando ocorre uma falha de renderizacao.

### Seguranca e coletor 1.6.1

- `ENABLE_REMOTE_SCRIPT_EXECUTION=false` tornou-se o padrao documentado;
- API recusa criar jobs, heartbeat nao entrega jobs e coletor exige uma segunda
  flag local antes de executar qualquer comando;
- frontend informa o modo de simulacao/registro e nao oferece execucao real;
- rotas publicas e do coletor receberam limites dedicados;
- payload do coletor passou a ter limite local de 1 MB;
- tarefa agendada descreve apenas inventario e heartbeat;
- usuario logado segue opcional e desligado por padrao.

### Auditoria e pendencias

- criada `docs/AUDITORIA-BETA-PROFISSIONAL.md` com arquitetura, privacidade,
  matriz de riscos e controles;
- assinatura de codigo, atualizacao automatica assinada e homologacao em VM
  limpa continuam pendentes antes de uso em cliente real.

## 2026-08-02 - Reparo do agente e ciclo real de manutencao

### Instalador e agente 1.6.1

- o instalador detecta a instalacao existente e oferece `Reparar ou atualizar`,
  preservando chave, token, identificacao e configuracao da maquina;
- a tarefa do coletor e recriada como `SYSTEM`, com gatilhos no boot e logon,
  execucao em bateria, inicio assim que possivel e tentativas apos falha;
- o loop do agente deixou de depender de uma espera longa: recarrega a
  configuracao e retoma o heartbeat logo depois de suspensao ou hibernacao;
- a coleta de Office e softwares foi ampliada para registros de maquina e
  perfis de usuario carregados, sem criar exclusoes de antivirus.

### Auditoria das anotacoes operacionais

- o link `Abrir chamado` instalado no Windows agora recebe uma identificacao
  assinada e limitada da ativacao; ao escolher `O problema e na minha maquina`,
  o chamado usa automaticamente a maquina correta sem expor a chave do produto;
- o modo de reparo renova esse link para instalacoes existentes e recria o
  atalho publico com a identificacao atual;
- maquinas sem contato ficam `Offline` durante os primeiros tres dias e passam
  para `Erro` somente depois desse prazo, com a mesma regra em dashboard,
  inventario e cards;
- o nome fantasia passou a substituir o hostname no objeto compartilhado pelo
  frontend, preservando o hostname apenas como dado tecnico e fallback;
- plantas podem ser excluidas pelo botao vermelho da barra superior e o zoom
  por roda/clique so captura a interacao quando a ferramenta de lupa esta ativa;
- ordens nao finalizadas continuam visiveis nos meses seguintes; ordens
  finalizadas permanecem visiveis ate o mes em que foram encerradas.

### Ordens de servico e inventario

- a entrada e saida de manutencao passaram a ser persistidas no backend;
- criacao, vinculacao, troca de maquina, finalizacao e exclusao de OS agora
  sincronizam o segmento de manutencao e o historico da maquina;
- chamados publicos, sugestoes aceitas e OS geradas por preventiva usam o mesmo
  ciclo de manutencao;
- foram criadas as tabelas `maintenance_records` e `backup_assignments`, com
  indices por maquina, OS e status;
- o frontend deixou de simular localmente a manutencao e recarrega o estado
  canonico do servidor.

### Execucao e limites

- sugestoes, preventivas e automatizacoes continuam usando a fila autenticada
  de trabalhos do agente, com tipo permitido, timeout e limite de saida;
- os testes validam enfileiramento, claim, resultado e historico, sem executar
  um BAT arbitrario no computador de desenvolvimento;
- o instalador faz upgrade preservando ativacao, mas autoatualizacao silenciosa
  assinada ainda nao foi implementada;
- SMART, temperatura, licencas e alguns dados de hardware continuam sujeitos ao
  suporte de firmware, driver, Windows e politicas da organizacao.

### Validacoes

- 178 testes aprovados e 1 teste dependente de PostgreSQL real ignorado;
- o teste integrado reproduziu criacao de OS, vinculacao posterior, entrada em
  manutencao, desvinculacao e saida da manutencao;
- lint, build de producao, arquitetura e `git diff --check` aprovados;
- o smoke E2E foi alinhado ao contrato atual de `/api/health`, que informa
  `database: "ok"` quando a conexao esta saudavel;
- Inno Setup 6.7.3 compilou o instalador Windows 1.6.1;
- SHA-256 do instalador:
  `1D8D4C51626D1F4CDE8ED369F717C7CC254FA632D0898BA83912EA7087494C4E`.

### Compatibilidade desta atualizacao

- uma instalacao nova ja recebe o atalho identificado durante a ativacao;
- uma instalacao anterior deve executar o instalador 1.6.1 e escolher
  `Reparar ou atualizar` uma vez para renovar o atalho sem perder a ativacao.

## 2026-07-29 - Alias nos avisos e inventario ampliado do agente 1.5.0

### Entrega

- sugestoes de OS passaram a resolver o nome fantasia persistido da maquina,
  inclusive para avisos criados antes da alteracao;
- titulos dos cards foram resumidos para formatos como `RAM alta em <maquina>`
  e `Disco em alerta em <maquina>`;
- a seta do card de maquina real voltou a exibir os perifericos coletados, em
  modo somente leitura;
- coletor Windows 1.5.0 passou a enriquecer CPU, modulos de memoria, video,
  placa-mae, bateria, adaptadores de rede e perifericos Plug and Play;
- os novos dados foram distribuidos nas abas Hardware, Rede e Perifericos do
  inventario, preservando a organizacao atual da interface;
- instalador e desinstalador foram recompilados na versao 1.5.0.

### Validacoes

- 165 testes unitarios aprovados e 1 teste dependente de PostgreSQL real
  ignorado;
- 9 testes de integracao aprovados e 1 teste dependente de PostgreSQL real
  ignorado;
- lint, build de producao e compilacao do instalador aprovados;
- `git diff --check` aprovado;
- SHA-256 do instalador:
  `7E789297A7C74EA5B82B42793E2A2206DBC5EF30EAC7CB3FCDD6C050060781B2`.

### Pendencias conhecidas

- as maquinas existentes precisam receber o coletor 1.5.0 e concluir uma nova
  coleta para que os campos adicionais e perifericos aparecam;
- SMART, temperatura, desgaste, licencas e sensores dependem do que o Windows,
  o fabricante e as permissoes do endpoint realmente disponibilizam; o sistema
  nao inventa valores quando a fonte nao responde;
- assinatura do instalador e ensaio em maquina Windows limpa continuam
  necessarios antes da distribuicao publica.

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

## 2026-07-29 - Inventario real ampliado e nomes fantasia persistentes

### Entrega

- agente Windows 1.4.0 passou a coletar arquitetura, nucleos fisicos, usuario
  local consentido, saude dos modulos de memoria, Office, licencas parciais,
  softwares instalados e detalhes dos discos;
- discos agora usam `MSFT_StorageReliabilityCounter` e SMART legado como
  fallback para temperatura, horas ligadas, setores realocados, desgaste e
  estimativa de saude, respeitando o que cada fabricante disponibiliza;
- detalhes ampliados do agente sao validados, limitados a 1 MB e persistidos
  em `agent_assets.inventory_details`;
- nome fantasia de ativos do agente passou a ser salvo no servidor e
  preservado nos heartbeats posteriores;
- cards, diagnosticos e historico de avisos usam o nome fantasia sem perder o
  hostname tecnico usado na correlacao;
- inventario abre sempre no Quadro quando acessado pela navegacao principal;
- objetos claros do editor 2D, especialmente PCs sobre mesas, recebem uma cor
  de contraste por tipo para nao desaparecerem;
- titulo da planta recebeu espaco adicional controlado para nomes de ambiente;
- instalador e desinstalador Windows foram recompilados na versao 1.4.0.

### Execucao de scripts

- o fluxo autenticado de BAT, CMD e PowerShell permanece restrito ao agente
  Windows instalado;
- o servidor cria a tarefa, o agente a retira por heartbeat, executa em
  processo controlado, devolve resultado e registra log e historico do ativo;
- nenhuma execucao ocorre dentro da Vercel ou do navegador.

### Validacoes

- 165 testes do servidor aprovados, 1 ignorado por exigir PostgreSQL real e
  nenhuma falha;
- teste de integracao do agente confirmou inventario ampliado, persistencia do
  nome fantasia, retirada de tarefa, resultado e historico;
- teste PowerShell do agente aprovado;
- lint e `git diff --check` aprovados;
- build de producao aprovado com 2.353 modulos transformados;
- Inno Setup 6.7.3 compilou com sucesso o instalador Windows 1.4.0.

### Limitacoes conhecidas

- SMART, temperatura, vida util e dados de licenca dependem do suporte do
  hardware, driver, fabricante e edicao do Windows;
- a saude do disco e exibida como estimativa quando calculada por desgaste ou
  atributos SMART, sem prometer precisao que o dispositivo nao fornece;
- maquinas instaladas com agente anterior precisam atualizar para 1.4.0 para
  enviar os novos campos.

## 2026-07-29 - Protecao de renderizacao e hardware segmentado

### Incidente

- a tela podia ficar branca ao renderizar registros estruturados de software
  como filhos React;
- o erro de producao indicava um objeto com os campos `name`, `version`,
  `installedAt` e `manufacturer`.

### Correcao

- valores estruturados de inventario agora passam por formatacao segura antes
  de chegar ao JSX;
- a lista resumida de softwares usa rotulos legiveis e chaves estaveis;
- a aba Hardware foi dividida em sistema, processador, memoria, video,
  placa-mae, armazenamento, energia e licenciamento;
- modulos de memoria, adaptadores de video e discos possuem detalhamento
  individual, sem misturar todos os dados em uma unica grade.

### Compatibilidade

- formatos antigos, textos simples e os novos objetos enviados pelo agente sao
  aceitos simultaneamente;
- dados ausentes continuam apresentados como indisponiveis, sem interromper a
  pagina inteira.

## 2026-07-29 - Avisos consolidados e perifericos manuais

### Avisos e nomes

- alertas e preventivas passam a usar o nome fantasia da maquina, mantendo o
  hostname como fallback;
- sugestoes ativas da mesma maquina aparecem em um unico card, com problemas
  resumidos, ocorrencias acumuladas e prioridade recalculada;
- quando a validacao de um BAT confirma a resolucao, o problema vinculado deixa
  o agrupamento; sem problemas ativos, o card desaparece;
- avisos sem nova ocorrencia sao encerrados automaticamente apos 48 horas por
  padrao, com o prazo editavel nas configuracoes de Avisos.

### Perifericos

- a lista exibida no card e nos detalhes da maquina agora contem somente os
  perifericos cadastrados manualmente pelo tecnico;
- inclusoes e remocoes sao persistidas por usuario e registradas no historico
  da maquina;
- dados eventualmente coletados pelo agente permanecem separados e nao
  preenchem a lista manual.

### Validacoes

- build de producao aprovado;
- 171 testes aprovados e 1 ignorado por exigir PostgreSQL real;
- testes novos cobrem nome fantasia, fallback, consolidacao, escalonamento de
  prioridade, remocao progressiva de problemas, prazo configuravel e separacao
  entre perifericos coletados e cadastrados manualmente;
- lint e `git diff --check` aprovados.

