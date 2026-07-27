# Teste em Maquinas Reais

Use duas maquinas na mesma rede: uma como servidor e outra como cliente
Windows. Nao valide o beta somente com dados demo.

## Servidor

1. Inicie com `.\installers\windows\start-server.ps1`.
2. Execute `.\installers\windows\diagnose-server.ps1`.
3. Confirme `http://IP-DO-SERVIDOR/health`.
4. Crie administrador e enrollment conforme `docs/BETA-FUNCIONAL.md`.
5. Libere as portas 80 e 4000 apenas na rede privada, se o firewall bloquear.

## Cliente Windows

1. Confirme que `Invoke-RestMethod http://IP-DO-SERVIDOR/health` funciona.
2. Execute `test-heartbeat.ps1` com o token.
3. Instale o agente com intervalo de 300 segundos.
4. Confirme a tarefa `IT Guardian Agent`.
5. Abra o inventario no servidor e localize o hostname.

## Evidencias minimas

- health com `ok: true` e `database: ok`;
- login administrativo real;
- heartbeat HTTP 202;
- maquina visivel com origem Agent;
- campos de hardware e `lastSeenAt`;
- transicao online -> offline -> online;
- log do agente sem token;
- ativo correlacionado e persistido no mapa 2D;
- backup criado e restaurado em um ensaio controlado.

## Falhas comuns

- `401`: token incorreto ou revogado;
- `400`: payload fora do contrato;
- timeout: IP, porta ou firewall;
- health 503: PostgreSQL indisponivel;
- sem maquina no painel: confira tarefa e `agent.log`;
- sempre online: confira `AGENT_OFFLINE_AFTER_MINUTES` e reinicie o servidor.
