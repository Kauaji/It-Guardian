# Cloud, coletor Windows e licenciamento

Este documento descreve a arquitetura cloud do IT Guardian, o ciclo de uma
chave de produto e a instalacao do coletor Windows. O modo local continua
suportado e nao depende desta camada.

## Decisao de arquitetura

O caminho atual e um modelo hibrido de baixo risco:

| Componente | Execucao | Responsabilidade |
| --- | --- | --- |
| React/Vite | Vercel | Interface, administracao e abertura de chamado |
| Express | Funcao Vercel no mesmo dominio | API HTTP, ativacao e heartbeat |
| PostgreSQL | Supabase, Neon ou Postgres gerenciado | Fonte da verdade persistente |
| Coletor Windows | Computador monitorado | Inventario e heartbeat de saida |
| OCS/Zabbix | Processo com acesso a rede interna | Sincronizacao opcional e somente leitura |

O deploy atual `https://it-guardian-server.vercel.app` pode receber ativacoes e
heartbeats porque essas operacoes sao requisicoes HTTP curtas. Ele nao deve ser
tratado como um processo sempre ligado. Polling continuo, acesso a sistemas da
LAN e jobs frequentes devem rodar em uma VPS, servidor local ou futuro worker
dedicado.

Supabase nao e obrigatorio. O requisito real e um PostgreSQL persistente
compativel. `DATABASE_URL=memory` e somente para desenvolvimento e testes, e e
bloqueado em producao.

## Fluxo cloud

1. Um administrador gera uma chave de produto.
2. O instalador pede somente essa chave.
3. O instalador envia a chave, o fingerprint e o hostname por HTTPS para
   `POST /api/collector/activate`.
4. A API valida estado, expiracao e limite de computadores de forma
   transacional.
5. A API devolve um token de agente derivado. A chave de produto nao e
   persistida no computador.
6. O coletor envia inventario e heartbeat para `/api/agents/heartbeat`.
7. O ativo aparece no Inventario com origem `cloud_collector`/agente e, sem
   organizacao previa, fica em `Nao organizadas`.
8. O tecnico pode vincular o ativo a grupo, segmento e objeto do mapa 2D.

Uma reinstalacao com a mesma chave e o mesmo fingerprint reutiliza a ativacao,
revoga o token anterior e nao consome outra vaga. Fingerprints diferentes
disputam vagas por uma atualizacao atomica no banco.

## Banco de dados

A migracao `005-cloud-product-activation` cria:

- `product_keys`: hash, dica mascarada, organizacao, plano, limite, uso, estado
  e expiracao;
- `device_activations`: fingerprint em hash, hostname, alias, versao, estado e
  datas de contato;
- vinculos entre ativacao, enrollment e token do agente;
- campos adicionais de CPU, memoria, fabricante, modelo e serial no inventario
  do agente.

A chave completa e gerada com entropia criptografica, exibida uma vez e
armazenada apenas como SHA-256. O fingerprint tambem e armazenado em hash.

## Configuracao cloud

Variaveis minimas no Vercel:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
DB_SSL=true
JWT_SECRET=gere-uma-chave-aleatoria-com-pelo-menos-32-caracteres
FRONTEND_URL=https://it-guardian-server.vercel.app
PUBLIC_APP_URL=https://it-guardian-server.vercel.app
CORS_ORIGIN=https://it-guardian-server.vercel.app
ENABLE_DEMO_SEED=false
PING_MODE=mock
OCS_MODE=disabled
OCS_ENABLED=false
ZABBIX_MODE=disabled
ZABBIX_ENABLED=false
```

Variaveis de build do frontend:

```env
VITE_FRONTEND_URL=https://it-guardian-server.vercel.app
VITE_COLLECTOR_INSTALLER_URL=https://endereco-publico/ITGuardianCollectorSetup.exe
```

`VITE_COLLECTOR_INSTALLER_URL` pode apontar para um GitHub Release, Vercel Blob
ou outro armazenamento HTTPS. O executavel nao deve ser versionado no Git.

## Gerar e administrar chaves

Pela interface:

1. Entre como administrador.
2. Abra `Configuracoes gerais > Admin > Cloud e coletores`.
3. Informe nome, organizacao, plano, limite e expiracao opcional.
4. Gere e armazene a chave exibida. Ela nao podera ser recuperada depois.

Pela CLI:

```powershell
npm run product-key:create -- `
  --name "Cliente principal" `
  --organization "Empresa Exemplo" `
  --plan "Beta" `
  --limit 10 `
  --expires "2027-12-31"
```

O painel permite listar chaves mascaradas, consultar uso, ver computadores,
desativar uma ativacao e desativar ou reativar a chave. Desativar a chave revoga
os tokens ativos. Apenas administradores acessam `/api/product-keys`.

## Compilar o instalador

Pre-requisitos:

- Windows;
- Node.js e dependencias do repositorio;
- Inno Setup 6 instalado, ou `INNO_SETUP_COMPILER` apontando para `ISCC.exe`.

Na raiz:

```powershell
npm run installer:windows
```

Para outro dominio:

```powershell
.\installers\windows-collector\build-installer.ps1 `
  -ApiBaseUrl "https://it-guardian-server.vercel.app"
```

Saida:

```text
installers\windows-collector\output\ITGuardianCollectorSetup.exe
```

O script rejeita HTTP fora de localhost. A URL da API e incorporada no
executavel e nao e solicitada ao usuario.

## Instalar em um computador

1. Execute `ITGuardianCollectorSetup.exe` como administrador.
2. Informe a chave de produto.
3. Aguarde a validacao, instalacao e primeiro heartbeat.
4. Conclua o assistente.

O instalador:

- grava arquivos em `C:\ProgramData\ITGuardianCollector`;
- salva somente o token derivado em `config.json`;
- restringe a configuracao a SYSTEM e administradores;
- cria a tarefa `IT Guardian Cloud Collector` como SYSTEM na inicializacao;
- executa um primeiro heartbeat antes de concluir;
- cria `Abrir chamado - IT Guardian` na area de trabalho;
- registra logs locais e oferece desinstalacao.

Atalho de suporte:

```text
https://it-guardian-server.vercel.app/abrir-chamado
```

## Confirmar o computador no inventario

1. Abra o IT Guardian como administrador ou tecnico autorizado.
2. Entre em `Inventario`.
3. Pesquise pelo hostname do computador.
4. Confirme origem do agente/coletor e estado online.
5. Confira CPU, RAM, disco, Windows, fabricante, modelo, serial e ultimo contato.
6. Organize o ativo em grupo/segmento ou correlacione-o no mapa 2D.

Se o ativo nao aparecer:

```powershell
Get-ScheduledTask -TaskName "IT Guardian Cloud Collector"
Get-ScheduledTaskInfo -TaskName "IT Guardian Cloud Collector"
Get-Content "$env:ProgramData\ITGuardianCollector\logs\agent.log" -Tail 100
& "$env:ProgramData\ITGuardianCollector\diagnose-agent.ps1"
```

## Dados coletados

- MachineGuid usado localmente para produzir o fingerprint;
- hostname, Windows, versao e arquitetura;
- IP e MAC da interface ativa;
- CPU e uso percentual;
- memoria total, usada e livre;
- disco do sistema total e livre;
- fabricante, modelo e serial;
- uptime, versao do coletor e horario da coleta.

Nao sao coletados arquivos, senhas, teclas, tela, geolocalizacao, conteudo
pessoal ou lista detalhada de processos. O coletor nao recebe comandos, nao
executa scripts e nao possui mecanismo de atualizacao remota.

## OCS e Zabbix

OCS e Zabbix continuam opcionais e desabilitados por padrao.

- OCS importa inventario em modo somente leitura.
- Zabbix importa hosts, disponibilidade e problemas em modo somente leitura.
- Credenciais ficam em variaveis de ambiente e nunca sao devolvidas pela API.
- O instalador comum do coletor nao pede nem instala OCS/Zabbix.
- Para endpoints internos, rode a API/worker em uma maquina que alcance a LAN.
- Na Vercel, use apenas endpoints publicamente acessiveis por HTTPS, o que nao e
  recomendado para sistemas internos sem uma camada segura.

## Compatibilidade local

O modo Docker/local, os enrollments manuais e o agente anterior continuam
validos. A nova ativacao cloud apenas cria o enrollment automaticamente. Nao e
necessario converter uma instalacao local existente para usar o produto.

## Validacao

Comandos de liberacao:

```powershell
npm run lint
npm run check:architecture
npm run test --workspace server
npm run test:integration --workspace server
npm run build
git diff --check
```

Testes especificos:

```powershell
node --test server/test-integration/cloud-product-activation.test.mjs
node --test server/test-integration/windows-collector-installer-security.test.mjs
```

O instalador deve ser compilado e testado em uma VM Windows limpa antes da
distribuicao. O certificado de assinatura de codigo e uma etapa recomendada
antes de uma liberacao publica.

## Limitacoes conhecidas

- a Vercel nao substitui um worker permanente para LAN, polling ou jobs longos;
- o instalador precisa do Inno Setup 6 para gerar o `.exe`;
- o executavel ainda precisa de assinatura de codigo e ensaio em Windows limpo;
- OCS/Zabbix fazem sincronizacao administrativa manual nesta etapa;
- a URL de download do instalador depende de publicacao externa do artefato.
