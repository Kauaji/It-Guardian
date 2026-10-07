# 0004 — RustDesk como transporte opcional

**Estado:** aceito

## Contexto
O visualizador próprio por snapshots JPEG é lento e limitado. O RustDesk (código aberto) resolve visualização/controle.

## Decisão
RustDesk entra como **transporte opcional** dentro do mesmo fluxo de assistência remota: consentimento local, reautenticação
do técnico, sessão curta e auditoria permanecem. O servidor gera uma senha **por sessão**, a entrega ao agente, que a
configura no RustDesk local, e a revela ao técnico só durante a sessão autorizada; o ID do RustDesk fica no card da máquina.
O relay (hbbs/hbbr) é autohospedado (`docker-compose` perfil `rustdesk`). O transporte nativo continua disponível.

## Consequências
- (+) Qualidade de vídeo/controle muito melhor; reaproveita software mantido por terceiros.
- (−) Passa a existir um componente de infraestrutura (relay) e um binário de terceiros no agente (instalador).
- (−) A experiência real só é validável em máquinas Windows reais (ver [ASSISTENCIA-REMOTA.md](../ASSISTENCIA-REMOTA.md)).
