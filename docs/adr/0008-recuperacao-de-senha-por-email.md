# 0008 — Recuperação de senha por e-mail com link de uso único

**Estado:** aceito (complementa o [0001](0001-sessoes-revogaveis.md))

## Contexto
Sem canal de e-mail, "esqueci minha senha" só existia como redefinição assistida por um administrador (senha temporária).
Para implantar em várias empresas isso não escala: o administrador vira gargalo e, se ele mesmo perde a senha, só o acesso ao
servidor resolve. Ao mesmo tempo, recuperação por e-mail é um vetor clássico de tomada de conta e de enumeração de usuários.

## Decisão
- **Canal:** SMTP (`SMTP_HOST` + `MAIL_FROM`), via `nodemailer`. É o que qualquer empresa tem (servidor próprio, Microsoft 365,
  Google Workspace, provedores transacionais). Sem SMTP configurado a função fica **desligada** e a interface orienta pedir
  a redefinição a um administrador; a senha temporária continua existindo.
- **Token:** 256 bits aleatórios, enviado só no e-mail; o banco guarda apenas o SHA-256 (`auth_action_tokens`, com RLS). Uso
  único (consumo atômico num `UPDATE ... WHERE used_at IS NULL`), validade de 30 min (`PASSWORD_RESET_TTL_MINUTES`, 10 a 120),
  e um novo pedido invalida o anterior.
- **Link:** `{FRONTEND_URL}/redefinir-senha#token=…`. A base vem da configuração, **nunca** de cabeçalhos da requisição
  (Host forjado não redireciona o link). O token fica no fragmento (`#`), que não vai ao servidor nem ao `Referer`, e a página o
  remove da barra de endereços.
- **Sem enumeração:** o pedido responde sempre `202` com a mesma mensagem (conta existe, inativa, inexistente ou e-mail
  desligado), com piso de tempo de resposta. Limite por IP e de 3 links por conta por hora.
- **Efeito da troca:** valida a senha (mesma política) **antes** de gastar o link, grava, derruba todas as sessões, limpa o
  bloqueio e avisa por e-mail. **Não abre sessão e não desliga o MFA**: quem tem segundo fator continua precisando dele.
- **Administrador:** pode enviar o mesmo link a um usuário (`POST /api/users/:id/send-reset-link`) em vez de gerar senha temporária.

## Consequências
- (+) Autonomia do usuário, sem depender de administrador; fluxo auditado (`auth_password_reset_*`).
- (+) Nenhum segredo em log: o link só aparece no e-mail (e no console apenas com `MAIL_DEV_LOG=true` fora de produção).
- (−) Quem controla a caixa de e-mail do usuário controla a conta (mitigado por MFA, que a redefinição não remove).
- (−) Passa a existir uma dependência de entrega de e-mail; falha de envio é registrada e não revela nada ao requerente.
- (−) Uma dependência nova em produção (`nodemailer`, sem dependências próprias).
Detalhes operacionais: [IDENTIDADE-E-SESSAO.md](../IDENTIDADE-E-SESSAO.md) e [OPERATIONS.md](../OPERATIONS.md).
