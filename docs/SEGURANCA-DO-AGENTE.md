# Seguranca do IT Guardian Agent

## Estado seguro por padrao

A execucao remota real fica desabilitada por padrao. O servidor somente cria e
entrega jobs quando `ENABLE_REMOTE_SCRIPT_EXECUTION=true`; o coletor ainda exige
`enableRemoteScriptExecution=true` em sua configuracao local. O instalador
comum grava `false`, portanto habilitar apenas um dos lados nao executa nada.

Alem das duas flags, o coletor nativo (`ITGuardian.exe`) so executa um job ou
aplica uma atualizacao quando consegue **verificar uma assinatura** (secao
"Assinatura de atualizacoes e de jobs"). Sem a chave publica correspondente no
`config.json` ele **ignora a atualizacao e recusa o job**, e reporta a recusa
ao servidor. Isso vale para instalacoes novas e para as que ja existiam: um
agente atualizado para esta versao precisa receber as chaves para voltar a
executar jobs ou a se atualizar.

## Modelo de confianca

O agente e destinado a computadores administrados em uma LAN ou VPN. Ele envia
um payload de inventario para uma API conhecida usando token Bearer. Cada token
pertence a um enrollment e pode ser revogado.

Hoje o agente **tambem recebe codigo/instrucoes da API**: a resposta do
heartbeat pode trazer (a) um job de script para executar com a identidade do
coletor (`SYSTEM`) e (b) uma oferta de novo executavel do proprio agente, que
substitui `ITGuardian.exe`. Tudo que o agente confia vem de tres fontes, com
forcas diferentes:

| Fonte | O que ela garante | Onde fica o segredo |
| --- | --- | --- |
| TLS + token Bearer | o servidor contactado e o configurado e o agente e quem diz ser | token no `config.json` (so SYSTEM/Administradores) |
| Chave de **jobs** (`jobSigningPublicKey`) | o job foi emitido pelo servico IT Guardian, para ESTA maquina, para ESTE conteudo, agora | privada no servidor (`AGENT_JOB_SIGNING_PRIVATE_KEY`) |
| Chave de **release** (`releasePublicKey`) | o executavel oferecido foi liberado por quem controla a chave de release | privada **fora** do servidor da API (cofre/CI de release) |

### Por que sao duas chaves e por que a de release fica fora do servidor

A chave de jobs precisa estar no servidor porque e o servidor que cria os jobs;
ela protege contra adulteracao no caminho ou no banco e contra replay, mas **nao**
contra um servidor totalmente comprometido (quem o controla pode assinar jobs).

A chave de release assina o manifesto de atualizacao e **nunca esta na API**.
Se estivesse, comprometer a API equivaleria a executar codigo arbitrario como
`SYSTEM` em toda a frota por meio de uma "atualizacao". Fora do servidor, quem
invade a API consegue no maximo repetir manifestos ja assinados, e o agente
recusa versao igual ou menor que a instalada. A privada de release vive no
secret `AGENT_RELEASE_PRIVATE_KEY` do CI de release (ou numa maquina offline) e
e usada por `scripts/sign-agent-release.mjs`.

## Assinatura de atualizacoes e de jobs

Algoritmo: ECDSA P-256 com SHA-256, assinatura IEEE P1363 (`r||s`, 64 bytes) em
base64. Chaves publicas: base64 de `SubjectPublicKeyInfo` DER (91 bytes);
qualquer outra curva, tamanho ou ponto fora da curva e recusado. O agente
reconstroi a mensagem a partir dos campos recebidos (nunca confia numa string
pronta) e recusa campos com `CR`/`LF`. A verificacao esta em
`agent/windows/ITGuardian.Signing.cs` (aritmetica propria com `BigInteger`, so
verifica) e o protocolo do lado do servidor em
`server/src/security/agentSigning.js`.

**O que e assinado**

- Atualizacao (`ITG-UPDATE-V1`): `version`, `sha256` (minusculo) e `url`, com a
  assinatura em `latestVersionSignature` no heartbeat.
- Job (`ITG-JOB-V1`): `jobId` (= `job.id`), `assetId` (do job ou do heartbeat),
  `interpreter` (= `job.type`), `timeoutSeconds`, `contentSha256` (SHA-256
  UTF-8 do conteudo, calculado **no agente**) e `notAfter` (unix segundos), com a
  assinatura em `job.signature`.

**Regras do agente** (`agent/windows/ITGuardian.Policy.cs`, testadas em
`agent/windows/tests/`)

Atualizacao, avaliada **antes de baixar qualquer byte**:

1. sem `releasePublicKey`, a atualizacao e ignorada (log claro), salvo
   `allowUnsignedUpdates=true`, que e um opt-out explicito e registra um aviso
   a cada uso;
2. com chave, assinatura ausente ou invalida => recusa (`allowUnsignedUpdates`
   nao contorna);
3. URL `https`, versao oferecida **estritamente maior** que a do agente
   (mesma comparacao numerica por segmento do servidor) e SHA-256 com 64 hex;
4. depois do download: o SHA-256 do binario tem de bater com o valor
   **assinado**, o tamanho fica entre 100 KiB e 50 MiB e a URL final (apos
   redirecionamentos) tem de continuar em HTTPS;
5. a troca do executavel faz rollback se o novo arquivo nao puder ser movido.

Job:

1. sem `jobSigningPublicKey`, o job e recusado, salvo `allowUnsignedJobs=true`
   (opt-out ruidoso; com chave configurada a assinatura continua obrigatoria);
2. assinatura valida sobre os campos reconstruidos (conteudo trocado,
   interpretador, timeout, validade ou ativo alterados => recusa);
3. `assetId` assinado igual ao `machineId` desta maquina (o mesmo valor que o
   agente envia no heartbeat e que o servidor usa como `assetId`);
4. `notAfter` nao vencido, com tolerancia de relogio de 5 minutos;
5. `jobId` nunca visto: os ultimos 500 ids ficam em `state\seen-job-ids.txt`
   (escrita atomica; pasta so para SYSTEM/Administradores). O id e registrado
   **antes** de executar; se nao for possivel gravar o registro, o job e
   recusado. Arquivo corrompido nao quebra o agente: carrega vazio e avisa.

Um job recusado **nao executa**, e logado (`WARN`) e reportado ao servidor como
falha com a razao no `errorMessage`.

## Como configurar no agente

Campos de `config.json` (todos opcionais; ausentes = comportamento seguro):

- `releasePublicKey`: chave publica de release (base64 SPKI);
- `jobSigningPublicKey`: chave publica de jobs (base64 SPKI);
- `allowUnsignedUpdates` / `allowUnsignedJobs`: opt-out explicito, so valem sem
  a chave correspondente; use apenas em laboratorio.

Como as chaves chegam:

- **release**: embutida no instalador. `build-installer.ps1` aceita
  `-ReleasePublicKey` ou le `installers/windows-collector/release-public-key.txt`
  (a chave publica e gerada por `npm run agent:keys -- release`); sem ela o
  instalador e gerado com aviso e o agente instalado nao se atualiza. Em
  maquinas ja instaladas, rodar o instalador novo em "Reparar" grava a chave se
  ela ainda nao existir; tambem se pode editar o `config.json`.
- **jobs**: o servidor entrega `jobSigningPublicKey` na resposta de
  `POST /api/collector/activate` e o instalador a grava no `config.json`
  (confianca no primeiro uso, sobre TLS). Uma chave ja fixada **nunca** e
  sobrescrita (nem em "Trocar a chave de produto", nem pelo `Finalize`).
  `-JobSigningPublicKey` em `build-installer.ps1`/`Install-Agent.ps1` permite
  fixa-la fora do TLS da ativacao.

O log do coletor registra na partida a postura atual (fingerprint das chaves,
ou "nao configurada; bloqueado por padrao").

## O que um servidor comprometido consegue e nao consegue

Assumindo que o atacante controla a API (codigo, banco e variaveis de ambiente)
mas **nao** a chave privada de release nem tem acesso a maquina:

- **nao consegue** empurrar um executavel de atualizacao: nao tem como assinar
  o manifesto de release; um hash/URL trocados invalidam a assinatura;
- **nao consegue** forcar downgrade nem repetir um manifesto antigo (versao tem
  de ser estritamente maior);
- **nao consegue**, sem a chave de jobs, entregar um job novo, alterar o
  conteudo/interpretador/timeout de um job, move-lo para outra maquina,
  estender a validade nem reexecutar um job ja executado;
- **consegue** (por ter a chave de jobs no servidor) emitir jobs assinados
  validos para qualquer maquina que tenha `enableRemoteScriptExecution=true`.
  Os limites que restam sao os do proprio agente: flag local desligada por
  padrao, tipos BAT/CMD/PowerShell, timeout, saida limitada e aviso visual na
  bandeja. Quem nao quiser esse risco mantem a execucao remota desligada;
- **consegue** negar servico (nao entregar jobs/atualizacoes, recusar
  heartbeats) e ver o inventario enviado;
- **consegue** alterar campos nao assinados do job (`requiresAdmin`,
  `requiresLoggedUser`, `name`, `scriptId`): so afrouxam pre-condicoes locais
  e rotulos de exibicao; nao mudam o que executa;
- se a chave de jobs for roubada junto com o servidor, o agente nao tem como
  distinguir: rotacione a chave e redistribua `jobSigningPublicKey`.

Se o atacante tambem tiver a chave privada de release, ele pode empurrar
executaveis: essa chave e o ultimo elo e precisa de guarda propria.

## O que continua dependendo de voce

- **Certificado Authenticode**: o agente **nao** valida a assinatura Authenticode
  do binario baixado (o que o protege e a assinatura do manifesto + SHA-256).
  Sem certificado, SmartScreen e antivirus tratam os executaveis como nao
  assinados. `build-installer.ps1` assina `ITGuardian.exe`, o desinstalador e o
  instalador quando `IT_GUARDIAN_CODE_SIGN_*` estao configurados; o CI de
  Windows faz isso se os secrets `WINDOWS_CODESIGN_PFX_BASE64` e
  `WINDOWS_CODESIGN_PASSWORD` existirem.
- **Guarda da chave de release**: gerar fora do servidor, guardar em cofre/secret
  do CI de release, restringir quem pode rodar o workflow, ter procedimento de
  rotacao (nova `releasePublicKey` exige novo instalador ou edicao do
  `config.json`) e de revogacao.
- **Hospedar o executavel**: `AGENT_LATEST_VERSION`, `AGENT_LATEST_VERSION_URL`,
  `AGENT_LATEST_VERSION_SHA256` e `AGENT_LATEST_VERSION_SIGNATURE` no servidor
  devem ser exatamente os valores impressos por `scripts/sign-agent-release.mjs`
  (o CI publica `release-manifest.json`).
- **TOFU da chave de jobs**: a chave entregue na ativacao e confiada no primeiro
  uso; proteja a ativacao com TLS valido ou fixe a chave por
  `-JobSigningPublicKey`.
- **Relogio**: jobs expiram 15 minutos apos assinados (tolerancia de 5 min);
  maquinas com relogio muito errado recusam jobs.
- **Fonte de verdade das flags**: `allowUnsigned*` e `enableRemoteScriptExecution`
  sao editaveis por quem e administrador local da maquina; o `config.json`
  e protegido por ACL (SYSTEM/Administradores).

## Protecoes implementadas

- token gerado com 256 bits aleatorios;
- somente hash SHA-256 e prefixo ficam no banco;
- token completo aparece uma unica vez na criacao;
- configuracao local acessivel apenas por `SYSTEM` e administradores;
- payload com lista fechada de campos;
- limites de tamanho e validacao de numeros, data e intervalo;
- enrollment inativo ou revogado recebe `401`;
- rotas do coletor tem rate limit por hash do token, sem guardar o token no limiter;
- coletor e servidor recusam inventario acima do limite de 1 MB;
- logs nao incluem o token;
- historico registra cadastro e reconexao do agente;
- desinstalacao remove tarefa, configuracao e logs locais;
- trabalhos de manutencao permanecem bloqueados na beta por padrao;
- tipos permitidos limitados a BAT, CMD e PowerShell cadastrados;
- executaveis do Windows sao fixos, sem `shell: true`;
- timeout entre 15 e 600 segundos e saida limitada a 64 KiB;
- requisitos de administrador e usuario logado sao validados;
- resultado, erro, auditoria e historico da maquina sao persistidos;
- teste automatico procura primitivas perigosas e coleta invasiva;
- atualizacao so com manifesto assinado por chave fora do servidor, versao
  estritamente maior, URL HTTPS e hash do binario igual ao assinado;
- jobs so com assinatura valida, para a propria maquina, dentro da validade e
  uma unica vez (registro anti-replay persistente);
- testes automatizados em C# (`agent/windows/tests`) cobrem cada decisao de
  seguranca e o CI (`.github/workflows/windows-agent.yml`) compila e testa o
  agente em Linux (Mono) e Windows (csc.exe do .NET Framework);
- nenhum `catch` vazio nos fontes do agente (um teste falha se reaparecer):
  o que e engolido de proposito deixa rastro em `logs\agent.log`, com contexto
  e mensagem da excecao, com supressao de repeticoes iguais.

## Assistencia remota em laboratorio

O agente possui um modulo separado de assistencia remota, mas ele permanece
desabilitado por padrao. A ativacao exige flags nos dois lados, ambiente
permitido, permissoes do tecnico, reautenticacao recente e consentimento local.
Enquanto a sessao estiver ativa, a maquina exibe um indicador permanente e um
botao local de encerramento.

O modo atual usa snapshots JPEG com FPS, resolucao e qualidade configuraveis
dentro de limites seguros aplicados no servidor (1 a 5 FPS, no maximo
1920x1080, qualidade entre 10 e 95), com reducao automatica de qualidade
quando o quadro fica grande e deduplicacao de quadros identicos para poupar
banda. Uma sinalizacao WebRTC (oferta/resposta SDP) existe no backend para uma
evolucao futura do transporte, mas permanece desligada por padrao
(`REMOTE_ASSISTANCE_WEBRTC_ENABLED=false`) e sem nenhum peer real do lado do
navegador ou do agente — nenhuma tela adicional passa a trafegar por WebRTC
so por essa flag existir. Frames, comandos e a sinalizacao ficam somente no
relay efemero em memoria; nada disso e gravado no banco nem no historico.
Viewer e agente usam tokens curtos, separados do JWT e do enrollment. Consulte
[`ASSISTENCIA-REMOTA.md`](ASSISTENCIA-REMOTA.md) para o modelo completo.

## O que existe e o que nao existe

Existem, e por isso foram descritos acima com seus controles:

- **atualizacao automatica** do coletor nativo: o heartbeat pode trazer
  `latestVersion`, `latestVersionDownloadUrl`, `latestVersionSha256` e
  `latestVersionSignature` (ativado no servidor por `AGENT_LATEST_VERSION*`); o
  agente baixa o executavel, confere hash e assinatura, troca `ITGuardian.exe`
  e sai com codigo 42 para a tarefa agendada reinicia-lo. E o unico download de
  codigo para execucao;
- **execucao de scripts cadastrados** (BAT, CMD, PowerShell) entregues como job,
  apenas com as duas flags e com assinatura valida.

Nao existem:

- shell interativo ou comando arbitrario enviado diretamente pela API;
- download de outros tipos de codigo alem do proprio executavel do agente;
- captura de tela ou teclado fora de uma sessao remota visivel, autenticada e
  autorizada;
- clipboard remoto, gravacao ou transferencia de arquivos;
- coleta de arquivos, senhas ou navegacao;
- persistencia oculta;
- geolocalizacao;
- execucao sem script previamente cadastrado e trabalho persistido;
- acesso silencioso, bypass de UAC, tela preta ou bloqueio oculto de input.

O coletor usa APIs locais de inventario e HTTPS para heartbeat. O codigo de
compatibilidade da fila nao oferece terminal remoto e somente pode operar com
as duas flags explicitas, alem das validacoes de cadastro, assinatura, token e
ativo. O agente PowerShell legado (`it-guardian-agent.ps1`) nao executa jobs
nem se atualiza.

## Transporte e rotacao

Em laboratorio isolado, HTTP pode ser usado com risco conhecido. Fora de uma LAN
confiavel, configure HTTPS ou uma VPN antes de instalar agentes. Nao exponha a
porta da API diretamente na internet.

Revogue e substitua o enrollment quando:

- um token for copiado para local inadequado;
- um administrador deixar a equipe;
- um PC for perdido;
- o laboratorio terminar.

Um enrollment pode atender varias maquinas de um mesmo laboratorio. Para maior
isolamento, use um enrollment por setor ou lote de instalacao.

## Resposta a incidente

1. Revogue o enrollment.
2. Pare e desinstale a tarefa nos clientes.
3. Examine `agent_enrollments.last_used_at` e os heartbeats.
4. Gere novo token somente apos corrigir a causa.
5. Preserve os logs e o historico do ativo para auditoria.
6. Se houver suspeita de chave de jobs comprometida, gere um par novo
   (`npm run agent:keys -- jobs`), troque `AGENT_JOB_SIGNING_PRIVATE_KEY` no
   servidor e redistribua `jobSigningPublicKey` nos agentes (editar o
   `config.json`); ate la os agentes recusam os jobs novos.
7. Se houver suspeita de chave de release comprometida, gere outro par
   (`npm run agent:keys -- release`), publique um instalador com a nova
   `releasePublicKey` e substitua a chave nos agentes ja instalados antes de
   voltar a ofertar atualizacoes.
