# Identidade e sessão

Modelo ponta a ponta de autenticação do IT Guardian: login, sessões, bloqueio, política de senha, MFA (TOTP), recuperação, redefinição por administrador e como o cliente (React) reage a cada situação. Tudo aqui foi conferido no código; os arquivos de referência estão em cada seção.

## Visão geral

- A sessão é um **JWT HS256 em cookie HttpOnly** (`it_guardian_session`; em produção `__Host-it_guardian_session`, com `Secure`, `Path=/`, sem `Domain`, `SameSite=Lax`). O mesmo token também é devolvido no corpo (`token`) e o cliente o guarda **só em memória** (nunca em `localStorage`/`sessionStorage`), usando-o como `Authorization: Bearer` e para o WebSocket.
- Cada login cria uma linha em `auth_sessions` (revogável, com vida máxima absoluta). O JWT carrega `sid` (id da sessão) e `ver` (versão do token do usuário).
- Código: `server/src/services/sessionService.js`, `authService.js`, `mfaService.js`, `middleware/authMiddleware.js`, `security/sessionCookie.js`, `routes/authRoutes.js`.
- Cliente: `client/src/api/identityApi.js`, `client/src/auth/*`, `client/src/components/auth/*`.

## Sessões

| Conceito | Regra |
| --- | --- |
| Ociosidade | O token vale `SESSION_IDLE_SECONDS` (padrão 8 h). Cada `GET /api/auth/me` renova o cookie. |
| Vida absoluta | A sessão morre `SESSION_ABSOLUTE_SECONDS` (padrão 12 h) depois do login, mesmo em uso contínuo. Nunca é menor que a ociosidade. |
| Rotação | Depois de `SESSION_ROTATE_AFTER_SECONDS` (padrão 15 min) o `/auth/me` emite um token novo **da mesma sessão**, sem passar da vida absoluta. Um token roubado não se renova para sempre. |
| Revogação | `revoked_at` na linha da sessão. Revogam-se: logout (a sessão atual), "encerrar outras", troca de senha (todas, e abre uma nova), redefinição de senha/MFA por admin (todas do alvo). |
| Validação | A cada requisição: assinatura, tipo, sessão existente e não revogada, dentro da vida absoluta, `ver` igual ao `token_version` do usuário, usuário ativo. Qualquer falha devolve 401 `SESSION_INVALID`. |
| Registro | A sessão grava IP e `User-Agent` (cortado em 300 caracteres) para a lista "Sessões ativas". |
| Limpeza | `RETENTION_AUTH_SESSION_DAYS` (padrão 30) apaga sessões antigas. |

### Endpoints

- `GET /api/auth/me` → `{ user, token, session: { expiresAt, absoluteExpiresAt } }` (usado para restaurar a sessão ao abrir o app).
- `POST /api/auth/logout` → 204; revoga a sessão atual e encerra assistências remotas abertas.
- `GET /api/auth/sessions` → `{ sessions: [{ id, createdAt, lastSeenAt, absoluteExpiresAt, ip, userAgent, current }] }`.
- `DELETE /api/auth/sessions/:id` → 204 (404 se não for do usuário ou já revogada).
- `POST /api/auth/sessions/revoke-others` → `{ revoked }`.

## Login em dois passos

1. `POST /api/auth/login { email, password }`
   - Sem MFA: sessão normal (`{ user, token, session }`, cookie definido).
   - Com MFA: `{ mfaRequired: true, mfaToken }`. O `mfaToken` é um JWT de tipo `mfa`, válido **5 minutos**, que só serve para o passo 2 e **não** abre sessão.
2. `POST /api/auth/login/mfa { mfaToken, code }` ou `{ mfaToken, recoveryCode }` → sessão normal.

Detalhes que importam:

- **Sem enumeração de contas.** E-mail inexistente, usuário inativo, conta bloqueada e senha errada respondem de forma equivalente (`INVALID_CREDENTIALS` / `ACCOUNT_LOCKED`) e o servidor compara a senha contra um hash descartável para igualar o tempo de resposta.
- Anti-replay do TOTP: cada passo de 30 s só pode ser usado uma vez (`mfa_last_used_step`).
- Se o custo do bcrypt (`PASSWORD_HASH_COST`) subiu desde que a senha foi gravada, o hash é regravado em silêncio no login.
- Limites de taxa por IP: login/cadastro (`AUTH_RATE_LIMIT_MAX`), MFA (10 por 15 min) e ações sensíveis (troca de senha, setup/enable/disable de MFA, regerar códigos: 8 por 15 min). Quando excedidos devolvem 429 com a mensagem "Muitas tentativas…" (sem `code`).

## Bloqueio por tentativas

- Após `LOGIN_LOCKOUT_THRESHOLD` falhas seguidas (padrão 5; senha errada **ou** código MFA errado) a conta é bloqueada com tempo **progressivo**: 1 min, 5 min, 15 min e 60 min (o último se repete). Resposta: 429 `ACCOUNT_LOCKED`.
- Um login bem-sucedido zera contador e nível de bloqueio. Qualquer gravação de senha (troca própria ou redefinição por admin) também limpa o bloqueio e incrementa a `token_version` do usuário, o que invalida todos os tokens anteriores.
- Auditoria: `auth_login_failed`, `auth_lockout`.

## Política de senha

`server/src/domain/passwordPolicy.js` (estilo NIST 800-63B: comprimento e lista de bloqueio, sem regras de composição artificiais):

- mínimo de **12 caracteres**; máximo de **72 bytes** (limite do bcrypt, que ignora o excedente);
- não pode ser só espaços;
- não pode ser previsível (poucos caracteres distintos, repetições, sequências como `123456789012`);
- não pode ser comum (lista de senhas e sequências comuns, tolerando sufixos, acentos e leetspeak: `p@ssw0rd2024!` cai);
- não pode conter o nome nem a parte local do e-mail (trechos de 4+ caracteres).

Aplica-se ao cadastro do primeiro admin, à troca de senha e à criação de usuário por admin. Erro: 400 `WEAK_PASSWORD` com `details` (todas as regras violadas).

**No cliente** (`client/src/auth/passwordPolicy.js`) só é espelhado o que não exige lista: tamanho, bytes, só espaços, repetição/poucos caracteres distintos e nome/e-mail. Dá feedback imediato (checklist, medidor de força apenas ilustrativo). A lista de senhas comuns **não** é duplicada: se o servidor recusar, a tela mostra o erro dele.

### Troca de senha

`POST /api/auth/password { currentPassword, newPassword }`:

- confere a senha atual (401 `CURRENT_PASSWORD_INVALID`), aplica a política, recusa reuso (400 `PASSWORD_REUSED`);
- grava a nova senha, limpa `must_change_password`, **revoga todas as sessões** (inclusive de outros dispositivos) e devolve uma sessão nova para o dispositivo atual (`{ user, token, session }`);
- o cliente chama `handleAuth` com a sessão nova.

### Troca obrigatória (`mustChangePassword`)

Contas criadas por admin (`mustChangePassword` padrão `true`) e contas com senha redefinida por admin precisam trocar a senha. Enquanto isso o servidor responde **403 `PASSWORD_CHANGE_REQUIRED`** em tudo, exceto `/auth/me`, `/auth/logout` e `/auth/password`. Os usuários do seed de demonstração e o admin do `seed:admin` **não** têm essa marca (a coluna `must_change_password` tem padrão `FALSE`), então o admin demo `admin@itguardian.local` / `123456` entra normalmente.

## MFA (TOTP)

RFC 6238: 6 dígitos, passo de 30 s, tolerância de ±1 passo. Segredos TOTP ficam cifrados em repouso (AES-256-GCM, chave derivada de `MFA_ENCRYPTION_KEY`, ou do `JWT_SECRET` se ausente). Códigos de recuperação ficam apenas como hash SHA-256.

| Endpoint | Função |
| --- | --- |
| `GET /auth/mfa/status` | `{ enabled, requiredForAdmins, recoveryCodesLeft }` |
| `POST /auth/mfa/setup` | gera segredo pendente: `{ secret, otpauthUri }` (409 `MFA_ALREADY_ENABLED` se já ativo). Só vale depois de confirmado. |
| `POST /auth/mfa/enable { code }` | confirma com um código do app, ativa e devolve `{ recoveryCodes }` (10 códigos `XXXXX-XXXXX`, **mostrados uma única vez**). 400 `MFA_CODE_INVALID`, 400 `MFA_SETUP_NOT_STARTED`. |
| `POST /auth/mfa/disable` | exige **senha** e, além dela, `code` (TOTP) **ou** `recoveryCode`. 403 `MFA_REQUIRED` para administradores quando `MFA_REQUIRED_FOR_ADMINS` está ligado. |
| `POST /auth/mfa/recovery-codes` | mesma exigência (senha + segundo fator); gera 10 novos e invalida os antigos. |

### MFA obrigatório para administradores

Com `MFA_REQUIRED_FOR_ADMINS=true`, administrador sem MFA recebe **403 `MFA_ENROLLMENT_REQUIRED`** em tudo, exceto `/auth/me`, `/auth/logout`, `/auth/password` e as rotas de MFA (`status`, `setup`, `enable`).

### Recuperação

- Perdeu o aparelho: entre com um **código de recuperação** (cada um funciona uma vez; consumo é registrado na auditoria `auth_recovery_code_used`) e gere novos códigos em "Segurança da conta".
- Perdeu aparelho **e** códigos: um administrador usa "Redefinir MFA" (abaixo).

## Redefinição assistida por administrador

Rotas exigem administrador (`requireAdmin` em `server/src/routes/userRoutes.js`):

- `POST /api/users/:id/reset-password` → `{ temporaryPassword, user }`. A senha temporária (16 caracteres sem ambiguidades) existe **só nesta resposta**; o usuário fica com `mustChangePassword`, todas as sessões dele caem e o bloqueio é limpo. Auditoria `auth_password_reset_by_admin`.
- `POST /api/users/:id/mfa/reset` → 204. Remove o MFA e os códigos do alvo e derruba as sessões dele (`auth_mfa_reset_by_admin`).

Na interface (Configurações > Admin > Usuários) os botões "Redefinir senha" e "Redefinir MFA" pedem confirmação; a senha temporária aparece uma vez, com botão de copiar e aviso. Os botões não aparecem na própria conta do administrador (use "Segurança da conta"), e "Redefinir MFA" só aparece para quem tem MFA ativo.

## Cadastro do primeiro administrador

`POST /api/auth/register` só funciona enquanto **não existe administrador ativo** (transação com lock). Em produção (`NODE_ENV=production` ou Vercel) exige também o `setupToken` (corpo ou cabeçalho `x-setup-token`) igual a `SETUP_TOKEN`:

- sem `SETUP_TOKEN` configurado: 403 `SETUP_DISABLED` (use `npm run seed:admin`);
- token ausente ou errado: 403 `SETUP_TOKEN_INVALID`.

Na tela, o campo "Token de configuração inicial" é opcional (exigido só em produção).

## Variáveis de ambiente

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `JWT_SECRET` | (obrigatória em produção, 32+ caracteres) | Assina sessões e desafios MFA. |
| `SESSION_IDLE_SECONDS` | 28800 (8 h; aceita `SESSION_MAX_AGE_SECONDS` como alias) | Ociosidade/validade do token. Limites 300 s a 7 dias. |
| `SESSION_ABSOLUTE_SECONDS` | 43200 (12 h) | Vida máxima da sessão. Limites 600 s a 30 dias; nunca menor que a ociosidade. |
| `SESSION_ROTATE_AFTER_SECONDS` | 900 | Idade do token a partir da qual o `/auth/me` o rotaciona. Limites 60 s a 24 h. |
| `PASSWORD_HASH_COST` | 12 | Custo do bcrypt (10 a 14). Hashes antigos são regravados no login. |
| `LOGIN_LOCKOUT_THRESHOLD` | 5 | Falhas seguidas até o bloqueio (3 a 20). Escala 1/5/15/60 min fixa no código. |
| `AUTH_RATE_LIMIT_MAX` | 12 | Limite por IP em login/cadastro. |
| `MFA_REQUIRED_FOR_ADMINS` | false | Obriga administradores a cadastrar MFA. |
| `MFA_ENCRYPTION_KEY` | derivada do `JWT_SECRET` | Chave que cifra os segredos TOTP; permite rotacionar sem invalidar sessões (**trocar a chave invalida os MFA já cadastrados**). |
| `SETUP_TOKEN` | vazio | Habilita o cadastro inicial pela internet em produção. |
| `ENABLE_DEMO_SEED` / `DEMO_SEED_ALLOW_PRODUCTION` | false | Os dados de demonstração criam admins com senha pública (`123456`); em produção só valem com o **segundo** aviso `DEMO_SEED_ALLOW_PRODUCTION=true` (instância de apresentação). |
| `DB_SSL`, `DB_SSL_MODE`, `DB_SSL_CA` | `auto` | TLS do banco: `DB_SSL=false` desliga; `DB_SSL_MODE=verify` verifica certificado; `no-verify` aceita qualquer; `auto` verifica quando há `DB_SSL_CA` ou o provedor usa CA pública, senão segue sem verificar e **avisa** no boot e em `/health/ready`. |
| `RETENTION_AUTH_SESSION_DAYS` | 30 | Retenção de sessões encerradas. |
| `CLIENT_ORIGIN` | — | Origem permitida (CORS/CSRF por origem). |

## Como o cliente reage a cada código de erro

Os erros trazem `body.code` estável. O cliente lê esse código em `client/src/api/identityApi.js` (que preserva `code`, `details` e `statusCode`; o `apiFetch` genérico descarta o `code`) e traduz em `client/src/auth/errorMessages.js`.

| Código (HTTP) | Quando | Reação da interface |
| --- | --- | --- |
| `INVALID_CREDENTIALS` (401) | e-mail/senha errados (qualquer motivo) | "E-mail ou senha inválidos." (genérica), foco na senha. |
| `ACCOUNT_LOCKED` (429) | bloqueio por tentativas; 429 do rate limit também | "Muitas tentativas. Aguarde alguns minutos e tente novamente." |
| `MFA_CODE_INVALID` (400/401) | TOTP ou código de recuperação errado | "Código inválido…", limpa o campo e devolve o foco. |
| `MFA_CHALLENGE_INVALID` (401) | `mfaToken` expirou (5 min) ou inválido | Volta ao passo de e-mail/senha com aviso "A verificação expirou…". |
| `PASSWORD_CHANGE_REQUIRED` (403) | conta com troca pendente | O app só mostra a tela de troca (bloqueante). Detectada ao entrar (`user.mustChangePassword`) e por evento global quando qualquer chamada recebe esse 403. |
| `MFA_ENROLLMENT_REQUIRED` (403) | admin sem MFA com MFA obrigatório | Assistente de MFA bloqueante (ativação com QR). O cliente descobre pelo `requiredForAdmins` de `GET /auth/mfa/status` ao carregar e também pelo evento global. |
| `CURRENT_PASSWORD_INVALID` (401) | senha atual errada na troca, ou senha errada ao desativar MFA/regerar códigos | Mensagem no formulário e foco no campo da senha. **Não** derruba a sessão. |
| `PASSWORD_REUSED` (400) | nova senha igual à atual | "A nova senha precisa ser diferente da atual." |
| `WEAK_PASSWORD` (400) | política violada | Lista as regras devolvidas pelo servidor (`details`). |
| `SETUP_DISABLED` / `SETUP_TOKEN_INVALID` (403) | cadastro inicial em produção | Mensagens específicas no formulário de cadastro. |
| `MFA_REQUIRED` (403) | admin tentando desativar MFA obrigatório | O botão "Desativar" nem aparece para admins quando `requiredForAdmins`; o código é tratado por precaução. |
| `SESSION_INVALID` / `AUTH_REQUIRED` (401) | sessão expirada, revogada, versão trocada | Evento `it-guardian:auth-expired`: o app volta ao `/login` guardando o destino e mostra "Sua sessão expirou. Entre novamente." Só dispara com sessão ativa (um 401 atrasado depois de sair é ignorado), e 401 de credencial nunca derruba a sessão: sem loops. |

Telas e rotas do cliente:

- **Login** (`AuthScreen`): passo 1 e-mail/senha (`autocomplete` `username`/`current-password`); passo 2 código TOTP de 6 dígitos (`inputMode="numeric"`, `autocomplete="one-time-code"`, foco automático) com link "Usar código de recuperação" e botão "Voltar". Erros em região `role="alert"`.
- **Bloqueios**: `AccountGate` envolve o app autenticado e, se houver pendência, renderiza só a tela bloqueante (troca de senha ou assistente de MFA) sem montar rotas nem carregar dados.
- **Segurança da conta**: rota `/conta/seguranca`, aberta pelo menu da conta na barra superior (ícone de pessoa). Não depende de permissão. Reúne troca de senha, MFA (ativar com QR gerado localmente com a lib `qrcode` + chave manual, códigos de recuperação exibidos uma vez com copiar/baixar, regerar, desativar) e lista de sessões (dispositivo, IP, último uso, "Esta sessão", encerrar uma ou todas as outras).
- O QR e o segredo TOTP nunca saem do navegador para serviços externos; os códigos de recuperação não são persistidos no cliente.

## Limitações conhecidas

- **Não existe "esqueci minha senha" por e-mail**: não há canal de e-mail confiável. O fluxo é a **redefinição assistida por um administrador** (senha temporária + troca obrigatória). Se o único administrador perde a senha, é preciso usar `npm run seed:admin`/intervenção no servidor.
- Perda simultânea de aparelho e códigos de recuperação exige um administrador (ou, para o único admin, acesso ao servidor).
- O `apiFetch` genérico (`client/src/api.js`) ainda não repassa `code`; chamadas fora de `identityApi` que recebem 403 de conta restrita aparecem só como erro de mensagem. O app evita isso bloqueando antes (`AccountGate` decide por `mustChangePassword` e por `/auth/mfa/status`). Recomenda-se, quando o módulo de API for consolidado, fazer `apiFetch` publicar `code` e disparar `it-guardian:account-restricted`.
- O medidor de força no cliente é ilustrativo; quem decide é o servidor.
- Sessões usam cookie `SameSite=Lax` + verificação de origem (CSRF por origem); não há SSO/OIDC nem WebAuthn/passkeys.
- A lista de sessões mostra o `User-Agent` em rótulo simplificado ("Chrome em Windows"); o IP registrado vem de `req.ip` com `trust proxy` = 1 (um proxy reverso na frente); com mais saltos o IP pode não ser o do cliente.

## Testes

- Servidor: `server/test-integration/auth-identity.test.mjs` cobre todos os fluxos e formatos de resposta.
- Cliente: `client/src/api/identityApi.test.js`, `client/src/auth/*.test.js`, `client/src/components/auth/*.test.jsx`, `client/src/components/settings/UserSecurityActions.test.jsx`, `client/src/App.identity.test.jsx`.
- E2E: `tests/e2e/identity.spec.js` (login do admin demo e página de segurança).
