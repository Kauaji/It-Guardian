# Fluxo de avisos, OS e preventivas

## Aviso e sugestão

1. O monitoramento registra o aviso.
2. A avaliação de recorrência pode criar uma sugestão de OS.
3. A sugestão não cria OS automaticamente.
4. Um usuário autorizado aceita ou rejeita a sugestão.

## Aceite

O aceite cria uma única OS com origem `alert_suggestion`, vincula a sugestão e
registra o evento no histórico da OS, no histórico da máquina e no log geral.
Aceitar novamente a mesma sugestão retorna a OS já vinculada e não cria
duplicidade.

## Rejeição

A rejeição preserva a sugestão, registra motivo e prazo de silêncio, adiciona
histórico na máquina e mantém o dado disponível para análise de falso positivo.

## Atendimento e fechamento

Depois de criada, a OS segue o fluxo normal de status, atendimento e
finalização. `created_at` continua definindo o mês de abertura; `closed_at`
registra somente a finalização.

## Preventiva manual

O técnico seleciona máquinas e verificações, revisa e registra um plano. O
registro atualiza o histórico das máquinas, mas não cria OS automaticamente.
Uma OS preventiva pode ser criada depois, por decisão explícita.

## Automação preventiva

A automação associa recorrência, horário, scripts e máquinas a um plano
preventivo. A configuração geral afeta o plano; overrides por segmento ou
máquina alteram apenas o alvo correspondente.

Ordem de resolução da recorrência:

1. personalizada para a máquina;
2. herdada do segmento;
3. herdada do plano;
4. valor padrão.

Pausar e excluir são operações diferentes. Pausar preserva o plano para
reativação. Excluir é lógico, desativa agendas futuras e preserva histórico,
runs e auditoria.

## Segurança

O sistema cadastra, agenda, prepara e audita. Ele não executa BAT, CMD,
PowerShell ou comandos do sistema operacional. Uma execução futura depende de
agente seguro externo.
## Complemento desta rodada

A automacao preventiva agora diferencia explicitamente pausa, reativacao e edicao. Pausar desativa agendas futuras sem excluir historico; reativar recalcula a proxima preparacao das agendas validas e registra auditoria e historico por maquina. A listagem da agenda deve respeitar o escopo do usuario antes da paginacao.
