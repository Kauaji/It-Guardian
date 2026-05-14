# Jobs futuros

Esta pasta fica reservada para a fase em VPS:

- polling real de ping em rede interna;
- sincronizacao recorrente do OCS Inventory;
- leitura recorrente de triggers/metricas do Zabbix;
- reconciliacao de alteracoes de hardware e historico automatico.

No Vercel, a API deve permanecer leve e orientada a requisicoes HTTP. Jobs continuos devem rodar em VPS,
worker dedicado ou agente instalado dentro da rede da empresa.
