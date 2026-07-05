# Dashboard

## Fonte dos dados

O dashboard usa dados retornados pelo backend. Nenhuma métrica deve ser
inventada no frontend. Quando a informação não existe, a interface deve ocultar
o indicador ou apresentar estado indisponível.

## Indicadores atuais

O resumo operacional prioriza saúde dos ativos, avisos e situação preventiva.
Os cards devem navegar para o módulo correspondente somente quando existe um
filtro real que possa ser aplicado.

## Métricas futuras seguras

Podem ser adicionadas quando houver consultas e regras consolidadas:

- OS abertas, concluídas e criadas por período;
- ranking de máquinas com recorrência;
- preventivas vencidas e em dia;
- planos automatizados e automações com erro;
- máquinas sem preventiva;
- avisos críticos.

OS atrasadas dependem de SLA ou prazo persistido. Enquanto esse dado não
existir, essa métrica não deve ser exibida.

## Validação

Toda nova métrica precisa de:

1. consulta no backend;
2. regra de período documentada;
3. teste com dados e sem dados;
4. verificação de permissão;
5. destino ou filtro válido quando o card for clicável.
