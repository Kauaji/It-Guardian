# IT Guardian Local Lab

Perfil oficial para executar o IT Guardian em um PC servidor dentro da rede
local. O perfil usa Docker Compose com PostgreSQL, API Express e frontend Nginx.

## Requisitos

- Windows 10/11 ou Windows Server com PowerShell 5.1 ou superior.
- Docker Desktop em execucao.
- Portas TCP `80` (painel) e `4000` (API direta) livres.
- O repositorio do IT Guardian disponivel no PC servidor.

Depois da primeira compilacao das imagens, a operacao normal nao depende da
internet.

## Preparar o ambiente

Na raiz do repositorio:

```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
```

Troque obrigatoriamente `POSTGRES_PASSWORD` e `JWT_SECRET`. A chave JWT deve ter
pelo menos 32 caracteres. O script recusa os valores de exemplo.

Inicie:

```powershell
npm run local:start
```

Ou use o instalador:

```powershell
.\installers\windows\Install-ITGuardianServer.ps1
```

Acesse `http://localhost` no servidor ou `http://IP-DO-SERVIDOR` em outro
computador da rede. O endpoint de diagnostico e
`http://IP-DO-SERVIDOR/health` (via frontend) ou
`http://IP-DO-SERVIDOR:4000/health` (API direta).

## Primeiro administrador

O perfil nao inclui senha fixa. Crie o primeiro administrador dentro do
container:

```powershell
docker compose --env-file .env.local -f docker-compose.local.yml exec server node src/cli/createLocalAdmin.js --name "Administrador" --email "admin@empresa.local" --password "troque-por-uma-senha-forte"
```

Equivalente fora do container, quando a API usa um PostgreSQL acessivel:

```powershell
npm run seed:admin -- --name "Administrador" --email "admin@empresa.local" --password "senha-com-12-ou-mais"
```

## Token do agente

Crie um enrollment. O token completo aparece uma unica vez:

```powershell
docker compose --env-file .env.local -f docker-compose.local.yml exec server node src/cli/createAgentEnrollment.js --name "Laboratorio Windows"
```

Guarde o token em um gerenciador de segredos. O banco armazena somente o hash
SHA-256 e um prefixo para identificacao. Um administrador tambem pode criar,
listar e revogar enrollments pela API autenticada.

Diagnostico do servidor:

```powershell
.\installers\windows\diagnose-server.ps1
```

## Operacao

```powershell
npm run local:stop
npm run local:start
npm run local:backup
npm run local:restore -- -BackupFile .\backups\it-guardian-AAAAMMDD-HHMMSS.dump
```

Para restaurar, os containers devem estar iniciados. O restore substitui o banco
e solicita confirmacao.

Reset completo:

```powershell
npm run local:reset
```

O reset remove o volume PostgreSQL e pede confirmacao. Para desinstalar o perfil
sem apagar dados:

```powershell
.\installers\windows\Uninstall-ITGuardianServer.ps1
```

Use `-RemoveData` somente quando quiser apagar o banco local.

## Rede, CORS e firewall

O frontend usa `/api` e `/ws` no mesmo host, encaminhados pelo Nginx. Agentes
podem usar `http://IP-DO-SERVIDOR` como `serverUrl`. Libere somente as portas
necessarias na rede confiavel. O CORS do navegador aceita os enderecos
configurados; requisicoes de agente sem contexto de navegador usam token Bearer.

Em redes nao confiaveis, publique o servidor apenas por HTTPS ou VPN. HTTP e
adequado somente para laboratorio LAN controlado.

## Backup e limites atuais

- O backup inclui o PostgreSQL, nao as imagens Docker.
- O modo local nao instala atualizacoes automaticamente.
- O agente nao oferece terminal remoto nem aceita comandos arbitrarios. Ele
  executa somente trabalhos de manutencao previamente cadastrados, entregues
  pela fila autenticada e auditada do IT Guardian.
- A associacao de maquinas a grupos, segmentos e mapa continua sendo feita no
  painel.
