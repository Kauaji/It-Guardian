# IT Guardian Beta Funcional

Este e o roteiro oficial para validar o IT Guardian em um laboratorio local. O
perfil usa PostgreSQL persistente, API Express e frontend Nginx no Docker
Compose. OCS e Zabbix ficam desabilitados e nao sao requisitos.

## 1. Requisitos

- Windows 10/11 ou Windows Server;
- PowerShell 5.1 ou superior;
- Docker Desktop iniciado;
- portas 80 e 4000 livres;
- repositorio em disco;
- um segundo computador Windows para validar o agente.

## 2. Preparar e iniciar

Na raiz do projeto:

```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
```

Defina senhas novas. `POSTGRES_PASSWORD` nao pode ficar com o exemplo e
`JWT_SECRET` deve ter ao menos 32 caracteres aleatorios.

```powershell
.\installers\windows\start-server.ps1
.\installers\windows\diagnose-server.ps1
```

Abra:

- painel: `http://localhost`;
- health pelo Nginx: `http://localhost/health`;
- health direto: `http://localhost:4000/health`.

Resposta esperada:

```json
{
  "ok": true,
  "status": "ok",
  "service": "it-guardian-api",
  "database": "ok"
}
```

## 3. Criar o primeiro administrador

Nao existe senha administrativa fixa no beta. Crie a conta pelo CLI:

```powershell
docker compose --env-file .env.local -f docker-compose.local.yml exec server node src/cli/createLocalAdmin.js --name "Administrador" --email "admin@empresa.local" --password "uma-senha-forte-com-12-ou-mais"
```

Entre no painel com essa conta. Depois do primeiro administrador, o cadastro
publico de novas contas e bloqueado.

A versao beta ainda nao oferece troca de senha pela interface. Se o login
falhar, confirme email, senha, `/health`, horario do servidor e os logs da API.
Em um laboratorio descartavel sem acesso administrativo, restaure um backup
valido ou execute o reset confirmado e crie um novo administrador.

## 4. Gerar a chave do coletor

Como administrador, abra `Configuracoes gerais > Admin > Cloud e coletores` e
gere uma chave para a organizacao. A chave completa e exibida uma unica vez.

## 5. Instalar o coletor em outra maquina

Compile ou obtenha `ITGuardianCollectorSetup.exe`, execute como administrador e
informe somente a chave. O instalador valida a ativacao, configura o coletor
nativo como SYSTEM, inicia a bandeja e envia o primeiro heartbeat.

OCS e Zabbix nao sao baixados e nao sao requisitos para esta instalacao.
O instalador tambem mantem `includeLoggedUser` e a execucao remota desligados.

## 6. Validar inventario e disponibilidade

1. Abra Inventario.
2. Localize a maquina pelo hostname ou alias.
3. Confirme a origem `Agent`, IP, Windows, CPU, memoria, disco e ultimo contato.
4. Confirme o status `Online`.
5. Pare a tarefa na maquina cliente:

```powershell
Stop-ScheduledTask -TaskName "IT Guardian Agent"
```

6. Aguarde o periodo de `AGENT_OFFLINE_AFTER_MINUTES`.
7. Atualize o painel e confirme `Offline`.
8. Inicie novamente:

```powershell
Start-ScheduledTask -TaskName "IT Guardian Agent"
```

O proximo heartbeat atualiza `lastSeenAt` e restaura o estado online.

## 7. Vincular no mapa 2D

No Inventario, abra a planta existente, selecione um ativo TI e use
`Correlacionar maquina`. Escolha a mesma maquina recebida pelo agente. Salve e
recarregue a pagina para confirmar a persistencia. O mapa reutiliza o ativo do
inventario; nao cria uma copia.

## 8. Logs e diagnostico

Servidor:

```powershell
.\installers\windows\diagnose-server.ps1
docker compose --env-file .env.local -f docker-compose.local.yml logs --tail 100 server
```

Agente:

```powershell
& "$env:ProgramData\ITGuardianAgent\diagnose-agent.ps1"
Get-Content "$env:ProgramData\ITGuardianAgent\logs\agent.log" -Tail 50
```

Os logs nao devem exibir senha, JWT ou token completo do agente.

## 9. Encerrar

```powershell
.\installers\windows\stop-server.ps1
```

O banco e preservado. Para backup, restore e reset, consulte
`docs/BACKUP-E-RESTORE.md`.

Para desinstalar o agente no computador cliente:

```powershell
& "$env:ProgramData\ITGuardianAgent\Uninstall-Agent.ps1"
```

O script pede confirmacao antes de remover configuracao e logs.

## 10. Limitacoes conhecidas

- a validacao oficial e para laboratorio em LAN ou VPN;
- HTTP nao deve ser exposto diretamente na internet;
- o coletor nativo nao possui atualizacao automatica;
- OCS e Zabbix sao fontes opcionais e ficam desabilitados por padrao;
- scripts de manutencao operam em simulacao/registro por padrao; a execucao
  real fica bloqueada por `ENABLE_REMOTE_SCRIPT_EXECUTION=false`;
- backup cobre o PostgreSQL, nao imagens Docker nem arquivos externos;
- a migracao idempotente em PostgreSQL real deve ser confirmada no ensaio final;
- o primeiro teste completo exige um segundo computador Windows real.

## 11. Proximos passos pos-beta

1. executar o checklist em duas maquinas reais;
2. configurar HTTPS ou VPN para ambientes fora da LAN de laboratorio;
3. automatizar rotacao de enrollments e backups;
4. validar recuperacao de desastre com PostgreSQL real;
5. preparar empacotamento e assinatura do agente;
6. habilitar OCS ou Zabbix somente quando houver ambiente de homologacao.
