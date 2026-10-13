# Operacao e estabilizacao

## Ambientes

- Desenvolvimento: `DATABASE_URL=memory` apenas para trabalho offline e testes rapidos.
- Integracao: PostgreSQL 16 efemero no GitHub Actions.
- Homologacao: PostgreSQL separado, seed de demonstracao desativado.
- Producao: PostgreSQL gerenciado, `JWT_SECRET` aleatorio com pelo menos 32 caracteres e seed desativado.

O backend impede `DATABASE_URL=memory` em producao.

## Comandos de qualidade

```sh
npm run lint
npm run check:architecture
npm test
npm run test:coverage
npm run test:e2e
npm run build
npm audit
```

`npm run check` executa lint, verificacao de arquitetura, testes com pisos de
cobertura e build. A CI exige no minimo 40% de linhas, 60% de branches e 30% de
funcoes na cobertura agregada. O teste de integracao com PostgreSQL real usa
`TEST_DATABASE_URL`; sem essa variavel ele e ignorado de forma explicita.

Os testes E2E sobem servidores isolados nas portas `4100` e `5174`. Isso evita
que um servidor de desenvolvimento antigo altere o resultado da validacao.

## Migracoes

O bootstrap legado esta isolado em `server/src/schema/legacyBootstrap.js` para preservar compatibilidade. Mudancas novas ficam em `server/src/migrations` e sao registradas em `schema_migrations`.

As migracoes executam em uma unica transacao e usam um advisory lock transacional para impedir duas instancias de aplicarem o mesmo lote simultaneamente.

## Sessao e CSRF

- A sessao principal usa cookie `HttpOnly`, `SameSite=Lax` e caminho `/`, necessario para API e WebSocket.
- O cookie recebe `Secure` em ambientes equivalentes a producao.
- Mutacoes autenticadas por cookie exigem uma origem confiavel.
- Bearer token continua aceito para clientes de API e agentes autorizados.
- Tokens legados em `localStorage` e `sessionStorage` sao removidos pelo frontend.

## E-mail (recuperacao de senha)

"Esqueci minha senha" so funciona com e-mail configurado. Defina no ambiente do servidor (Vercel: Settings > Environment
Variables; Docker/Windows: `server/.env`) e reimplante:

| Variavel | Exemplo | Observacao |
| --- | --- | --- |
| `SMTP_HOST` | `smtp.office365.com` | Obrigatoria para ligar o envio |
| `SMTP_PORT` | `587` | 587 = STARTTLS (padrao), 465 = TLS implicito |
| `SMTP_USER` / `SMTP_PASSWORD` | conta de servico | Use senha de aplicativo/credencial propria, nunca a de uma pessoa |
| `MAIL_FROM` | `IT Guardian <nao-responda@suaempresa.com.br>` | Obrigatoria. O dominio precisa ter SPF/DKIM, senao cai no spam |
| `FRONTEND_URL` | `https://itguardian.suaempresa.com.br` | Base do link do e-mail. **Confira**: um valor errado quebra o link |
| `PASSWORD_RESET_TTL_MINUTES` | `30` | Validade do link (10 a 120) |

Provedores comuns: Microsoft 365 (`smtp.office365.com:587`, habilitar "SMTP AUTH" na caixa), Google Workspace
(`smtp.gmail.com:587` com senha de app), ou um servico transacional (Brevo, SendGrid, Mailgun via SMTP). Sem `SMTP_HOST` +
`MAIL_FROM` a funcao fica desligada (a tela de login orienta falar com um administrador) e nada e enviado.

Para testar: peca o link na tela de login com um e-mail de teste cadastrado. Falhas de envio ficam no log como
`password_reset_mail_failed` e na auditoria (`auth_password_reset_requested` com `delivered: false`); o requerente nunca ve o motivo.
Em desenvolvimento, `MAIL_DEV_LOG=true` imprime o e-mail (com o link) no console quando nao ha SMTP; e ignorado em producao.

## Preferencias do usuario

Preferencias persistentes do inventario usam `/api/preferences` e a tabela `user_preferences`. O armazenamento local e apenas cache de contingencia; o backend e a fonte da verdade.

## Backup e restauracao

Antes de uma entrega:

```sh
pg_dump --format=custom --no-owner --file=it-guardian.dump "$DATABASE_URL"
```

Restauracao em banco vazio de homologacao:

```sh
pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" it-guardian.dump
```

Valide a restauracao em homologacao antes de depender do backup.

## Observabilidade

Cada resposta da API recebe `x-request-id`. Logs HTTP e erros sao JSON e incluem identificador, duracao, rota e status sem registrar credenciais ou corpo da requisicao. `/api/health` tambem verifica a conexao com o banco.

Alertas minimos recomendados:

- taxa de respostas 5xx;
- latencia p95;
- falha do `/api/health`;
- erro do pool PostgreSQL;
- falhas consecutivas do agendamento preventivo.

## Seguranca operacional

- Login possui limite por IP e e-mail.
- Corpos JSON e formularios sao limitados a 1 MB.
- O servidor possui timeouts explicitos.
- Nenhuma rotina preventiva executa BAT, CMD ou PowerShell no backend ou navegador.
- Execucao futura deve ocorrer somente por agente autenticado, assinado e isolado.

## Limitacoes conhecidas

- `App.jsx`, `AlertCenterV2.jsx` e o CSS global ainda pedem decomposicao incremental.
- O bootstrap-base ainda nao foi convertido integralmente em migracoes historicas.
- O teste de PostgreSQL real depende de `TEST_DATABASE_URL` ou do workflow de CI.
