# Checklist da Beta Funcional

## Servidor

- [ ] `.env.local` criado sem valores de exemplo
- [ ] PostgreSQL, API e frontend iniciados
- [ ] `GET /health` retorna `ok: true`
- [ ] banco retorna `database: ok`
- [ ] administrador criado sem senha fixa
- [ ] login e logout validados
- [ ] restart preserva os dados
- [ ] logs nao exibem segredos

## Agente Windows

- [ ] enrollment criado e token guardado
- [ ] `test-heartbeat.ps1` retorna sucesso
- [ ] tarefa instalada como SYSTEM
- [ ] heartbeat ocorre a cada cinco minutos
- [ ] maquina aparece com origem Agent
- [ ] hardware e ultimo contato aparecem
- [ ] parada da tarefa produz Offline
- [ ] retorno da tarefa produz Online
- [ ] revogacao do token produz 401
- [ ] `diagnose-agent.ps1` nao exibe o token

## Funcional

- [ ] inventario abre sem OCS ou Zabbix
- [ ] busca encontra a maquina real
- [ ] historico da maquina abre
- [ ] ativo real pode ser correlacionado no mapa 2D
- [ ] correlacao persiste apos recarregar
- [ ] backup e restore foram ensaiados
- [ ] agente foi desinstalado com confirmacao em uma maquina de teste

## Qualidade

- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run test:integration`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] nenhuma alteracao visual grande entrou na beta

## Limitacoes aceitas

- [ ] laboratorio usa LAN confiavel, VPN ou HTTPS
- [ ] OCS e Zabbix permanecem opcionais
- [ ] teste em PostgreSQL real foi executado ou registrado como pendencia
- [ ] teste com um segundo computador Windows foi executado ou registrado como pendencia
