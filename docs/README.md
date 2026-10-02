# Documentação do IT Guardian

Ponto de entrada. Para começar: [README do projeto](../README.md) → [INSTALACAO-LOCAL.md](INSTALACAO-LOCAL.md) →
[ARCHITECTURE.md](ARCHITECTURE.md). Contribuir: [CONTRIBUTING.md](../CONTRIBUTING.md). Segurança: [SECURITY.md](../SECURITY.md).

O script `npm run check:docs` falha o CI se algum link relativo estiver quebrado ou se um arquivo de `docs/` não estiver
listado aqui.

## Arquitetura e decisões
- [ARCHITECTURE.md](ARCHITECTURE.md) — visão geral, camadas do backend, frontend, hospedagem.
- [adr/](adr/README.md) — decisões de arquitetura (sessões, migrações, assinatura do agente, RustDesk, camadas, testes, CSP).
- [MIGRACOES.md](MIGRACOES.md) — esquema legado congelado, migrações somente-avante, `MIGRATIONS_MODE`, `db:migrate`.
- [QUALIDADE-SISTEMA.md](QUALIDADE-SISTEMA.md) — critérios de qualidade e verificações automáticas.
- [FRONTEND-DESIGN-SYSTEM.md](FRONTEND-DESIGN-SYSTEM.md) — tokens, componentes e padrões visuais.
- [TIPAGEM.md](TIPAGEM.md) — tipagem gradual com JSDoc e `tsc`.
- [PERFORMANCE-FRONTEND.md](PERFORMANCE-FRONTEND.md) — limites de bundle e como medi-los.

## Segurança
- [MODELO-DE-AMEACAS.md](MODELO-DE-AMEACAS.md) — STRIDE, controles e riscos residuais.
- [IDENTIDADE-E-SESSAO.md](IDENTIDADE-E-SESSAO.md) — sessões, MFA, senha, bloqueio, reset por administrador.
- [SEGURANCA-DO-AGENTE.md](SEGURANCA-DO-AGENTE.md) — confiança do agente, assinatura de jobs e atualizações.
- [SCRIPTS-MANUTENCAO-SEGURANCA.md](SCRIPTS-MANUTENCAO-SEGURANCA.md) — scripts de manutenção, aprovação e execução.

## Operação
- [OPERATIONS.md](OPERATIONS.md) — operação do dia a dia.
- [OBSERVABILIDADE.md](OBSERVABILIDADE.md) — logs, métricas, health, alertas, retenção e runbook.
- [BACKUP-E-RESTORE.md](BACKUP-E-RESTORE.md) — backup e restauração.
- [INSTALACAO-LOCAL.md](INSTALACAO-LOCAL.md) — ambiente local (Docker).

## Agente Windows e assistência remota
- [AGENTE-WINDOWS.md](AGENTE-WINDOWS.md) — instalação, configuração, coleta.
- [ASSISTENCIA-REMOTA.md](ASSISTENCIA-REMOTA.md) — consentimento, transportes (nativo e RustDesk), relay.
- [CLOUD-COLLECTOR-E-LICENCIAMENTO.md](CLOUD-COLLECTOR-E-LICENCIAMENTO.md) — ativação do coletor e chaves de produto.
- [TESTE-EM-MAQUINAS-REAIS.md](TESTE-EM-MAQUINAS-REAIS.md) e [TESTE-EM-COMPUTADORES-REAIS.md](TESTE-EM-COMPUTADORES-REAIS.md) — roteiros de validação em Windows real.

## Módulos funcionais
- Inventário: [INVENTARIO.md](INVENTARIO.md), [PRONTUARIO-TECNICO-ATIVO.md](PRONTUARIO-TECNICO-ATIVO.md), [FONTES-DE-DADOS.md](FONTES-DE-DADOS.md).
- Mapas: [MAPA-DE-REDE.md](MAPA-DE-REDE.md), [MAPA-DE-REDE-INVENTARIO.md](MAPA-DE-REDE-INVENTARIO.md), [MAPA-INFRAESTRUTURA.md](MAPA-INFRAESTRUTURA.md), [MAPA-VISUAL-3D-INVENTARIO.md](MAPA-VISUAL-3D-INVENTARIO.md).
- Plantas: [PLANTA-BAIXA.md](PLANTA-BAIXA.md), [EDITOR-DE-PLANTAS.md](EDITOR-DE-PLANTAS.md), [BIBLIOTECA-3D-E-LICENCAS.md](BIBLIOTECA-3D-E-LICENCAS.md).
- Atendimento: [ORDENS-DE-SERVICO.md](ORDENS-DE-SERVICO.md), [SLA-ORDENS-DE-SERVICO.md](SLA-ORDENS-DE-SERVICO.md), [ABERTURA-PUBLICA-CHAMADOS.md](ABERTURA-PUBLICA-CHAMADOS.md).
- Preventivas e automação: [PREVENTIVAS-UNIFICADAS.md](PREVENTIVAS-UNIFICADAS.md), [AUTOMATIZACOES-GERENCIAMENTO.md](AUTOMATIZACOES-GERENCIAMENTO.md), [FLUXO-AVISOS-OS-PREVENTIVAS.md](FLUXO-AVISOS-OS-PREVENTIVAS.md).
- Agenda e painel: [CALENDARIO-AGENDA-TECNICA.md](CALENDARIO-AGENDA-TECNICA.md), [DASHBOARD.md](DASHBOARD.md).
- Integrações opcionais: [INTEGRACAO-OCS.md](INTEGRACAO-OCS.md), [INTEGRACAO-ZABBIX.md](INTEGRACAO-ZABBIX.md), [DECISAO-OCS-ZABBIX-BETA.md](DECISAO-OCS-ZABBIX-BETA.md).

## Histórico (instantâneos; podem estar desatualizados)
Cada um começa com um aviso indicando que descreve o estado numa data. A fonte da verdade é o código e os documentos acima.
- [DIARIO-DE-BORDO.md](DIARIO-DE-BORDO.md) — registro cronológico de entregas.
- [DOCUMENTACAO-CODIGO-COMPLETA.md](DOCUMENTACAO-CODIGO-COMPLETA.md)
- [AUDITORIA-GERAL-CODIGO.md](AUDITORIA-GERAL-CODIGO.md), [AUDITORIA-BETA-PROFISSIONAL.md](AUDITORIA-BETA-PROFISSIONAL.md), [FRONTEND-DESIGN-AUDIT.md](FRONTEND-DESIGN-AUDIT.md)
- [BETA-FUNCIONAL.md](BETA-FUNCIONAL.md), [RODADA-CORRECOES-ANOTACOES.md](RODADA-CORRECOES-ANOTACOES.md)
- Fases: [FASE-1-INVENTARIO.md](FASE-1-INVENTARIO.md), [FASE-2-ORDENS-SERVICO.md](FASE-2-ORDENS-SERVICO.md), [FASE-3-AUDITORIA-TECNICA.md](FASE-3-AUDITORIA-TECNICA.md), [FASE-3-CHECKLIST-TESTES.md](FASE-3-CHECKLIST-TESTES.md), [FASE-3-IMPLEMENTACAO-REAL.md](FASE-3-IMPLEMENTACAO-REAL.md), [FASE-3-PLANO-MIGRACAO-BACKEND.md](FASE-3-PLANO-MIGRACAO-BACKEND.md)
