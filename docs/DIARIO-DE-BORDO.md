# Diario de bordo

Registro cronologico das entregas relevantes do IT Guardian. Toda consolidacao
funcional, mudanca operacional, migracao ou liberacao deve acrescentar uma
entrada neste arquivo com data, escopo, validacoes e pendencias conhecidas.

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

