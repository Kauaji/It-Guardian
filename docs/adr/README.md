# Decisões de arquitetura (ADRs)

Registros curtos de decisões que moldam o sistema: contexto, decisão, consequências. Para mudar uma decisão, escreva um
ADR novo que substitua o antigo (marque o antigo como *Substituído por*).

| # | Decisão | Estado |
|---|---|---|
| [0001](0001-sessoes-revogaveis.md) | Sessões revogáveis no servidor em vez de JWT autossuficiente | Aceito |
| [0002](0002-migracoes-somente-avante.md) | Migrações somente-avante e esquema legado congelado | Aceito |
| [0003](0003-assinatura-de-jobs-e-atualizacoes.md) | Assinatura ECDSA de jobs e atualizações do agente, com chave de release fora do servidor | Aceito |
| [0004](0004-rustdesk-transporte-opcional.md) | RustDesk como transporte opcional da assistência remota | Aceito |
| [0005](0005-camadas-do-backend.md) | Camadas do backend (domínio / repositório / serviço) verificadas no CI | Aceito |
| [0006](0006-testes-em-dois-bancos.md) | Suíte de integração em pg-mem e PostgreSQL real | Aceito |
| [0007](0007-csp-sem-recursos-externos.md) | CSP estrita: nenhum recurso externo no cliente | Aceito |
