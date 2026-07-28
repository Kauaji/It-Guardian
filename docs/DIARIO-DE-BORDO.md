# Diario de bordo

Registro cronologico das entregas relevantes do IT Guardian. Toda consolidacao
funcional, mudanca operacional, migracao ou liberacao deve acrescentar uma
entrada neste arquivo com data, escopo, validacoes e pendencias conhecidas.

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
- compilacao do instalador chegou corretamente ao compilador e confirmou como
  unica dependencia ausente o Inno Setup 6.

### Pendencias conhecidas

- instalar o Inno Setup 6 para gerar o executavel final neste computador;
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

