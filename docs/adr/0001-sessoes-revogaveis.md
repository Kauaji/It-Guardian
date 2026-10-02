# 0001 — Sessões revogáveis no servidor

**Estado:** aceito

## Contexto
O token de login era um JWT autossuficiente de 8 h: não dava para encerrar uma sessão (logout só apagava o cookie), trocar
a senha não invalidava tokens vazados, e o vínculo técnico↔usuário era feito por nome/e-mail (valores editáveis).

## Decisão
O JWT (HS256 fixado) carrega apenas `sid` (id da sessão), `ver` (versão de token do usuário) e `typ`. A verdade fica no
banco: tabela `auth_sessions` (revogável, com vida absoluta e ociosidade) e `users.token_version`. Cada requisição valida
sessão ativa, não expirada e versão igual. O token é rotacionado após 15 min de uso, limitado à vida absoluta. Trocar a
senha, desativar o usuário ou "sair de todos os dispositivos" revoga sessões. Login com bloqueio progressivo, comparação
de tempo constante (hash descartável para usuário inexistente), MFA TOTP com segredo cifrado (AES-256-GCM) e proteção
contra replay de código. Técnicos ligam-se a usuários por `technicians.user_id`.

## Consequências
- (+) Revogação real, auditoria de sessões, política de senha e MFA exigíveis.
- (−) Uma leitura de banco por requisição autenticada (mitigada pelo índice por PK e pelo pool).
- (−) Sem canal de e-mail, não há "esqueci minha senha": o reset é assistido por administrador.
Detalhes operacionais: [IDENTIDADE-E-SESSAO.md](../IDENTIDADE-E-SESSAO.md).
