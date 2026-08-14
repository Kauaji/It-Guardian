# Auditoria da beta profissional

Data: 2026-08-02

## Arquitetura auditada

O IT Guardian usa frontend React/Vite, API Express, PostgreSQL e um coletor
Windows nativo. O Vercel publica a aplicacao web e a funcao serverless da API.
O coletor envia inventario por HTTPS usando um token de enrollment armazenado
localmente com ACL restrita a `SYSTEM` e Administradores. OCS e Zabbix sao
adaptadores opcionais de leitura e nao fazem parte do instalador comum.

## Riscos encontrados e tratamento

| Prioridade | Risco | Tratamento |
|---|---|---|
| Critica | Fila de BAT/CMD/PowerShell podia operar sem um bloqueio global | `ENABLE_REMOTE_SCRIPT_EXECUTION=false` por padrao, validado na API, no claim e no coletor |
| Alta | HTML antigo podia apontar para chunk removido e deixar a tela branca | HTML sem cache, assets imutaveis, recarga unica com cache busting e Error Boundary |
| Alta | Rotas publicas e do coletor sem limite dedicado | limites por IP e por hash do Bearer token |
| Alta | Payload local podia crescer antes de chegar ao limite da API | coletor recusa inventario acima de 1 MB; servidor valida campos e tamanho |
| Media | Versao interna do coletor divergia do instalador | coletor e instalador alinhados em 1.6.1 |
| Media | Descricao da tarefa sugeria trabalhos remotos ativos | descricao corrigida para inventario e heartbeat |
| Alta | Assistencia de tela poderia ampliar a superficie de ataque | recurso separado, desligado por padrao, reautenticacao de 5 minutos, consentimento local, tokens distintos e auditoria |
| Alta | Frames poderiam expor dados se persistidos ou armazenados em cache | relay efemero, limite de 1 FPS, nenhum campo de frame no banco e resposta `no-store` |

## Controles confirmados

- endpoints administrativos exigem autenticacao e perfil administrador;
- ativacao, login, formulario publico e coletor possuem rate limit;
- token revogado e recusado;
- chave, fingerprint e token sao persistidos como hash quando aplicavel;
- payload do agente usa lista fechada de campos e limites numericos/textuais;
- outputs de jobs sao truncados em 64 KiB;
- logs do instalador e agente nao registram chave nem token completo;
- instalador comum inclui apenas o coletor nativo;
- usuario logado e execucao remota ficam desligados por padrao;
- tarefa agendada roda como `SYSTEM`, reinicia apos falha e recupera apos
  suspensao sem exigir reinstalacao.
- assistencia remota exige permissao granular, senha recente e agente ativo;
- somente uma sessao remota aberta por ativo e aceita;
- logout, timeout, encerramento local e perda de heartbeat encerram a sessao;
- cada transicao remota e registrada na sessao, maquina e OS vinculada;
- modo privacidade e acoes administrativas permanecem bloqueados;
- o resumo gerencial do dashboard (`GET /api/dashboard/summary`) exige a
  permissao `dashboard.view`, reaproveita apenas servicos ja existentes (sem
  nova consulta a dados sensiveis) e nunca simula OS vencidas nem dados de
  cliente sem base real.

## Dados e privacidade

O coletor pode enviar hostname, identificador tecnico, alias, IP, MAC, Windows,
CPU, RAM, discos, GPU, placa-mae, rede, bateria, perifericos, softwares,
uptime, versao e horario do heartbeat. O usuario logado so e enviado quando
`includeLoggedUser=true`.

O coletor nao captura senhas, arquivos pessoais, documentos, tela, teclado,
clipboard, historico de navegador, conversas, dados bancarios ou geolocalizacao
precisa.

## Riscos residuais antes de cliente real

1. O instalador e o coletor ainda precisam de assinatura de codigo confiavel.
2. Atualizacao automatica assinada ainda nao existe; usar `Reparar ou atualizar`.
3. A execucao remota deve permanecer desligada ate existir assinatura de
   scripts, segregacao de permissao e homologacao independente.
4. O rate limit em memoria do Vercel e complementar, nao substitui WAF ou store
   distribuido.
5. SMART, temperatura, licencas e alguns dados WMI variam conforme firmware,
   driver e politicas do Windows.
6. E obrigatoria uma homologacao em VM Windows limpa e outra maquina real antes
   de uso em cliente.
7. O transporte de assistencia atual usa snapshots de laboratorio e deve migrar
   para WebRTC com STUN/TURN homologado antes de uma oferta publica.
8. O modulo remoto nao deve ser habilitado em producao antes de assinatura de
   codigo, revisao independente e teste de invasao.
