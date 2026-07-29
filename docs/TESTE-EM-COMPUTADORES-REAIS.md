# Teste em computadores reais

Roteiro economico para validar o IT Guardian Local Lab com duas ou tres
maquinas.

## Topologia

- Maquina A: servidor local com Docker Desktop.
- Maquina B: Windows com IT Guardian Agent.
- Maquina C: segundo Windows com agente, quando disponivel.

Registre data, horario, hostname, IP e responsavel pelo teste. Use uma rede de
laboratorio e nao um token de producao.

## Checklist

1. Escolher o PC servidor.
2. Instalar o servidor local.
3. Acessar o painel por outro navegador.
4. Criar ou confirmar o administrador.
5. Gerar um enrollment e guardar o token.
6. Escolher o primeiro PC cliente.
7. Instalar o agente no PC cliente.
8. Confirmar a tarefa `IT Guardian Agent`.
9. Aguardar o primeiro heartbeat.
10. Confirmar a maquina no Inventario.
11. Conferir hostname, IP e sistema operacional.
12. Conferir ultimo heartbeat, versao e badge `Maquina real`.
13. Vincular a maquina a grupo e segmento.
14. Vincular o ativo no mapa 2D.
15. Reiniciar a tarefa do agente e confirmar novo heartbeat.
16. Reiniciar o PC cliente e confirmar retorno automatico.
17. Parar a tarefa ou desconectar a rede.
18. Aguardar pelo menos tres intervalos e confirmar status sem comunicacao.
19. Reativar e confirmar retorno para online.
20. Instalar e repetir na Maquina C, se disponivel.
21. Desinstalar o agente e confirmar que nao envia novos dados.
22. Criar backup do servidor.
23. Restaurar o backup em ambiente limpo, se possivel.

## Evidencias esperadas

- captura do inventario com origem `Agent`;
- horario e versao do ultimo heartbeat;
- hostname, IP, Windows, memoria e disco;
- transicao online, offline e online;
- vinculo no grupo, segmento e mapa;
- trecho do log sem token;
- tarefa agendada instalada e depois removida;
- arquivo de backup e resultado da restauracao.

## Criterios de aceite

- Cada `machineId` cria um unico ativo e heartbeats seguintes o atualizam.
- Duas maquinas podem usar o mesmo enrollment e aparecem separadamente.
- Token ausente, invalido ou revogado recebe `401`.
- Campos desconhecidos ou valores invalidos recebem `400`.
- Maquina manual sem agente continua abrindo normalmente.
- Nenhum comando arbitrario e executado; somente trabalhos cadastrados,
  autenticados e vinculados a maquina podem ser consumidos pelo coletor.

## Diagnostico

1. Teste `http://IP-DO-SERVIDOR:4000/api/health`.
2. Confira firewall das portas 80 e 4000.
3. Confira `serverUrl` sem `/api` no final.
4. Abra o log do agente.
5. Confira data e hora dos PCs.
6. Confirme que o enrollment continua ativo.
