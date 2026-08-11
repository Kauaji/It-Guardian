<div align="center">

# IT Guardian

### Plataforma de inventário, monitoramento e gestão de atendimento para ambientes de TI

![React](https://img.shields.io/badge/React-18-20232A?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Local%20Lab-2496ED?logo=docker&logoColor=white)
![Status](https://img.shields.io/badge/status-beta%20funcional-orange)

Projeto acadêmico e técnico desenvolvido para centralizar o inventário de ativos, o acompanhamento da infraestrutura e o fluxo de ordens de serviço em uma única aplicação.

</div>

## Visão geral

O **IT Guardian** é uma plataforma full stack criada para apoiar equipes de suporte e infraestrutura no controle de computadores, dispositivos de rede, setores, alertas e atendimentos técnicos.

O projeto nasceu como Trabalho de Conclusão de Curso e evoluiu para um MVP funcional, com ambiente local em Docker, banco PostgreSQL persistente, agente Windows, API Express e frontend React.

A arquitetura foi preparada para dois cenários:

- **Demo e apresentação:** frontend e API leve publicados no Vercel, com PostgreSQL externo.
- **Operação real:** coletor Windows nativo conectado por HTTPS; OCS Inventory e Zabbix permanecem adaptadores opcionais para ambientes que ja os possuem.

## Principais funcionalidades

### Inventário de ativos

- Cadastro manual e coleta por agente Windows.
- Organização por ambientes, grupos e segmentos.
- Movimentação de equipamentos por drag-and-drop.
- Busca por nome, IP, marca, modelo, patrimônio e segmento.
- Histórico, observações, periféricos e metadados técnicos.
- QR Code individual para consulta e impressão de etiquetas.
- Fluxo de manutenção integrado ao inventário.

### Ordens de serviço

- Abertura manual ou por formulário público.
- Vínculo opcional com máquinas e ativos cadastrados.
- Controle por status, prioridade e técnico responsável.
- Registro de diagnóstico, solução, peças e histórico.
- Criação automática de OS ao enviar um ativo para manutenção.
- Cadastros de clientes, produtos, serviços, técnicos e tipos de problema.

### Monitoramento e integrações

- Heartbeat e telemetria enviados pelo agente Windows.
- Estrutura preparada para ping real e alertas.
- Adaptadores opcionais e somente leitura para OCS Inventory e Zabbix.
- Persistência de snapshots de integração.
- Separação clara entre execução serverless e serviços que exigem acesso à rede local.

### Administração e segurança

- Autenticação JWT.
- Cadastro inicial controlado do primeiro administrador.
- Permissões e configurações validadas no backend.
- Bloqueio de configurações inseguras em produção.
- Logs de auditoria e confirmações de alertas.
- Seeds de demonstração restritos a ambientes autorizados.

## Arquitetura

```text
Coletor Windows nativo
              |
              v
       API Node.js + Express
              |
              v
          PostgreSQL
              |
              v
     Frontend React + Vite
```

OCS e Zabbix podem alimentar a API por adaptadores avancados de leitura, mas
nao fazem parte do instalador comum nem sao requisitos da beta. Consulte
[`docs/DECISAO-OCS-ZABBIX-BETA.md`](docs/DECISAO-OCS-ZABBIX-BETA.md).

Por seguranca, a execucao remota de BAT, CMD ou PowerShell fica desabilitada por
padrao (`ENABLE_REMOTE_SCRIPT_EXECUTION=false`). Sugestoes, preventivas e
automacoes nao enviam comandos ao coletor nessa configuracao. A auditoria atual
esta em [`docs/AUDITORIA-BETA-PROFISSIONAL.md`](docs/AUDITORIA-BETA-PROFISSIONAL.md).

A Assistencia Remota e um modulo separado, desabilitado por padrao e destinado
somente a laboratorio/homologacao nesta versao. Ela exige permissao,
reautenticacao do tecnico e consentimento visivel na maquina atendida. Consulte
[`docs/ASSISTENCIA-REMOTA.md`](docs/ASSISTENCIA-REMOTA.md).

Estrutura principal:

```text
it-guardian/
├── api/                     Função serverless usada no Vercel
├── client/                  Frontend React + Vite
├── server/src/
│   ├── config/              Ambiente, banco, CORS e segurança
│   ├── controllers/         Controllers HTTP
│   ├── routes/              Rotas da API
│   ├── repositories/        Persistência e acesso a dados
│   ├── services/            Regras e orquestração de domínio
│   ├── integrations/        Ping, OCS Inventory e Zabbix
│   └── jobs/                Processos persistentes e sincronizações
├── agents/                  Agente e coletor Windows
├── installers/              Scripts e instaladores
├── docs/                    Documentação técnica e acadêmica
└── release/                 Checklists e artefatos de beta
```

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React, Vite, React Router, dnd-kit, Recharts e Lucide |
| Backend | Node.js, Express e JWT |
| Banco de dados | PostgreSQL |
| Infraestrutura local | Docker Compose, Nginx e scripts PowerShell |
| Deploy de demonstração | Vercel com Supabase ou Neon |
| Integrações | Agente Windows, OCS Inventory e Zabbix |
| Testes e validação | Node Test Runner, smoke tests e checklists manuais |

## Executar o beta local

O caminho recomendado para testar o sistema completo é o perfil local com Docker Compose.

### Requisitos

- Docker Desktop
- PowerShell
- Git

### Inicialização no Windows

```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
.\installers\windows\start-server.ps1
```

Antes de iniciar, altere no arquivo `.env.local`:

```env
POSTGRES_PASSWORD=uma-senha-forte
JWT_SECRET=uma-chave-grande-e-segura
```

Depois, acesse:

- Aplicação: `http://localhost`
- Verificação da API: `http://localhost/health`

O procedimento completo de instalação, criação do administrador e ativação do agente está em [`docs/BETA-FUNCIONAL.md`](docs/BETA-FUNCIONAL.md).

## Executar em modo de desenvolvimento

```bash
npm install
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run dev
```

Em outro terminal:

```bash
npm run dev:server
```

Endereços locais:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Health check: `http://localhost:4000/health`
- WebSocket: `ws://localhost:4000/ws`

Para uma demonstração local sem PostgreSQL, é possível utilizar `DATABASE_URL=memory` exclusivamente em ambiente de desenvolvimento.

## Deploy de demonstração

O deploy no Vercel atende bem a apresentação acadêmica, autenticação, CRUD, inventário, segmentos, histórico, ordens de serviço e QR Code.

Variáveis principais:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=uma-chave-grande-e-segura
FRONTEND_URL=https://seu-projeto.vercel.app
PUBLIC_APP_URL=https://seu-projeto.vercel.app
PING_MODE=mock
OCS_MODE=disabled
OCS_ENABLED=false
ZABBIX_MODE=disabled
ZABBIX_ENABLED=false
```

Ping contínuo, monitoramento real e integrações com serviços internos exigem um processo persistente com acesso à rede da empresa. Ambientes serverless não alcançam diretamente endereços privados da LAN.

## Scripts principais

```bash
npm run dev          # Frontend em desenvolvimento
npm run dev:server   # API local
npm run build        # Build de produção
npm run start        # API em modo start
npm run docker:up    # Inicia o ambiente Docker
npm run docker:down  # Encerra o ambiente Docker
```

## Documentação

### Beta e operação

- [Instalação e validação da beta](docs/BETA-FUNCIONAL.md)
- [Teste em máquinas reais](docs/TESTE-EM-MAQUINAS-REAIS.md)
- [Backup, restauração e reset](docs/BACKUP-E-RESTORE.md)
- [Checklist de liberação](release/beta/CHECKLIST-BETA.md)
- [Diário de bordo](docs/DIARIO-DE-BORDO.md)

### Arquitetura e funcionalidades

- [Fase 1 — Inventário](docs/FASE-1-INVENTARIO.md)
- [Fase 2 — Ordens de serviço](docs/FASE-2-ORDENS-SERVICO.md)
- [Fase 3 — Implementação real](docs/FASE-3-IMPLEMENTACAO-REAL.md)
- [Documentação completa do código](docs/DOCUMENTACAO-CODIGO-COMPLETA.md)
- [Instalação local](docs/INSTALACAO-LOCAL.md)

### Agente e integrações

- [Agente Windows](docs/AGENTE-WINDOWS.md)
- [Segurança do agente](docs/SEGURANCA-DO-AGENTE.md)
- [Assistencia remota em laboratorio](docs/ASSISTENCIA-REMOTA.md)
- [Cloud, coletor e licenciamento](docs/CLOUD-COLLECTOR-E-LICENCIAMENTO.md)
- [Integração OCS Inventory](docs/INTEGRACAO-OCS.md)
- [Integração Zabbix](docs/INTEGRACAO-ZABBIX.md)
- [Fontes de dados](docs/FONTES-DE-DADOS.md)

## Estado atual

O projeto está em **beta funcional** e já possui:

- inventário e segmentação de ativos;
- agente Windows integrado ao backend;
- ordens de serviço e formulário público;
- autenticação, permissões e auditoria;
- execução local com Docker e PostgreSQL;
- preparação para coletores licenciados e monitoramento externo;
- documentação de instalação, testes e operação.

## Próximos passos

- Ampliar testes automatizados de frontend e integração.
- Evoluir o monitoramento contínuo em ambiente persistente.
- Validar a implantação em uma rede real com múltiplos equipamentos.
- Refinar dashboards, indicadores e notificações.
- Aplicar code splitting no frontend para reduzir o bundle principal.

## Autor

**Kauã Marques**  
Técnico de Informática e estudante de Análise e Desenvolvimento de Sistemas.

Experiência em suporte N1/N2, infraestrutura, manutenção de computadores, redes e ambiente hospitalar. O IT Guardian reúne conhecimentos de desenvolvimento full stack, banco de dados, automação e operação de TI em um projeto aplicado.
