# Modelo de ameaças (STRIDE)

Escopo: API (Node/Express), cliente web (React), PostgreSQL, agente Windows, assistência remota (nativa e RustDesk) e a
cadeia de build/entrega. O objetivo é tornar explícito **o que protegemos, de quem, com que controles e o que sobra**.

## Ativos

| Ativo | Por que importa |
|---|---|
| Credenciais e sessões de usuários (especialmente administradores) | Dão acesso a todos os dados e a ações sobre máquinas |
| Tokens de enrollment dos agentes | Permitem enviar inventário e receber jobs como a máquina |
| Capacidade de executar scripts e atualizar binários nos agentes | Execução remota de código nas máquinas administradas |
| Sessões de assistência remota (tela/controle) | Acesso à tela e ao teclado de um usuário final |
| Dados de clientes, inventário, OS, anexos | Informação pessoal/comercial |
| Segredos de configuração (`JWT_SECRET`, chaves de assinatura, DSN, tokens de cron/métricas) | Quebram os controles acima |

## Fronteiras de confiança

1. Internet/LAN ↔ API (TLS no proxy/Vercel). 2. API ↔ PostgreSQL (TLS; verificável com `DB_SSL_CA`). 3. API ↔ agente
(Bearer de enrollment + assinatura de jobs/atualizações). 4. Navegador ↔ API (cookie `HttpOnly`, CSP). 5. Pipeline de
build ↔ artefatos distribuídos (Authenticode opcional, SBOM, assinatura de release).

## Ameaças e controles

### Spoofing (falsificação de identidade)
| Ameaça | Controle | Residual |
|---|---|---|
| Força bruta / credential stuffing no login | Política de senha (≥12, lista de senhas comuns), bcrypt custo 12, bloqueio progressivo por conta, limitador por IP, comparação em tempo constante, MFA TOTP (obrigatório para admins por configuração) | Ataque distribuído lento contra senha fraca sem MFA; mitigado ligando `MFA_REQUIRED_FOR_ADMINS` |
| Roubo de token de sessão | Cookie `HttpOnly`/`Secure`/`SameSite`, prefixo `__Host-` em produção, sessão revogável, rotação, vida absoluta, token fora da URL (WebSocket autentica por cookie) | XSS ou malware no navegador do usuário |
| Falsificação de JWT | HS256 fixado (`alg` não negociável), `sid`/`ver`/`typ` validados no banco, segredo ≥32 chars | Vazamento do `JWT_SECRET` |
| Agente falso | Token de enrollment de 256 bits (só o hash fica no banco), revogável, limite de taxa por token | Roubo do token da máquina |
| Servidor falso diante do agente | HTTPS; atualizações e jobs **assinados** (chaves públicas fixadas no agente) | Servidor falso sem as chaves privadas não executa nada no agente |

### Tampering (adulteração)
| Ameaça | Controle | Residual |
|---|---|---|
| Atualização maliciosa do agente | Manifesto assinado com chave de release **fora do servidor**; versão estritamente maior; hash conferido; HTTPS | Comprometimento da máquina de build/chave de release |
| Script adulterado no caminho ou no banco | Hash do conteúdo pinado na fila, re-verificado na entrega; assinatura do job (ativo, conteúdo, validade); anti-replay | Quem controla servidor **e** chave de jobs cria jobs válidos (restritos aos scripts aprovados e às flags dos dois lados) |
| Adulteração do log de assistência remota | Cadeia de hash por evento (adulteração ou remoção no meio da cadeia é detectável) e chaves estrangeiras `ON DELETE RESTRICT` (apagar ativo/sessão não leva a trilha junto) | DBA com acesso total ao banco consegue reescrever a cadeia inteira; não há bloqueio por trigger |
| SQL injection | Consultas parametrizadas; teste de varredura contra SQL interpolado no domínio de scripts; rejeição de chaves `__proto__` | Código novo que fuja da convenção (barrado em revisão) |
| Mutação de rotas sem autorização | Matriz de autorização automática: percorre **todas** as rotas Express e prova 401 sem login e 403 sem permissão | Permissão de granularidade errada numa rota nova (revisão) |

### Repudiation (repúdio)
| Ameaça | Controle |
|---|---|
| Ação administrativa negada | `audit_logs` com usuário, IP, user-agent e `requestId`; eventos `auth_*` para login, falha, bloqueio, MFA, troca de senha, reset por admin |
| Sessão remota negada | Eventos encadeados por hash; consentimento local registrado |

### Information disclosure (vazamento)
| Ameaça | Controle | Residual |
|---|---|---|
| Segredos em logs | Logger com redação (tokens, senhas, cookies, query string, `/track/<token>`) | Segredo colocado em campo com nome inesperado (revisão) |
| Mensagens de erro reveladoras | 5xx genérico em produção; `code` só de erros conhecidos; `requestId` para suporte | — |
| Enumeração de usuários | Mesma mensagem e tempo parecido para e-mail inexistente/senha errada/bloqueado | Canal lateral de tempo em condições extremas |
| Dados de catálogo/cliente a quem não deveria | Leitura de catálogos exige permissão de OS; escopo de técnico por `technicians.user_id`; RLS ligado nas tabelas (modo PostgreSQL) | — |
| Interceptação do banco | TLS; verificação do certificado quando `DB_SSL_CA`/`DB_SSL_MODE=verify` | Sem a CA configurada o TLS **não verifica** o servidor (aviso `db_tls_unverified`) |
| Vazamento a terceiros pelo navegador | CSP sem recursos externos; fontes auto-hospedadas; `Referrer-Policy: no-referrer` | — |

### Denial of service
| Ameaça | Controle | Residual |
|---|---|---|
| Inundação de requisições | Limite global por credencial (anônimo por IP), limites específicos de login/agentes/público, corpo limitado, timeouts do servidor HTTP | Ataque volumétrico exige WAF/CDN na frente |
| Crescimento ilimitado de tabelas | Retenção diária em lotes (heartbeats, métricas, sessões, reauth) | Tabelas sem política (ex.: auditoria por padrão) |
| Limitador indisponível | Falha aberta **com métrica e alerta** (`itguardian_rate_limit_store_errors_total`) | Janela sem limite até a correção |

### Elevation of privilege
| Ameaça | Controle | Residual |
|---|---|---|
| Usuário comum vira admin | Permissões validadas no servidor por rota; testes de matriz; reset de senha/MFA só por admin; `must_change_password` bloqueia a API até a troca | — |
| Primeiro cadastro por estranho | Em produção `register` exige `SETUP_TOKEN` (ou CLI), com lock transacional | Token de setup vazado antes do uso |
| Seed de demonstração em produção | Ignorado em produção sem `DEMO_SEED_ALLOW_PRODUCTION=true`; `error` registrado | Operador que force a flag |
| Execução remota por privilégio indevido | Flags nos dois lados, aprovação por segundo revisor para risco alto, só scripts cadastrados, sem shell livre | — |
| Controle remoto sem consentimento | Consentimento local, indicador permanente, botão de encerrar, reautenticação, sessão curta | Falha do agente no Windows real (testes em máquina real pendentes) |

## Cadeia de suprimentos
Dependências: `npm audit` (alto/crítico em produção bloqueia), Dependabot semanal, revisão de dependências em PR, SBOM
CycloneDX gerado no CI, CodeQL (JS e C#) e gitleaks. `pg-mem` é só de desenvolvimento (não vai à imagem de produção).
Binários do instalador: certificado Authenticode **depende do titular do projeto** (ver SEGURANCA-DO-AGENTE.md).

## Riscos residuais aceitos (com dono)
1. `style-src 'unsafe-inline'` (estilos inline do React/bibliotecas).
2. TLS do banco não verificado até `DB_SSL_CA` ser configurada (aviso em log e diagnóstico).
3. Sem "esqueci minha senha" por e-mail: reset assistido por administrador.
4. Controle remoto e agente: fluxo completo só validado em Windows real fora deste repositório.
5. Chave de jobs no servidor: servidor totalmente comprometido pode assinar jobs (limitados aos scripts aprovados).

## Revisão
Revisar este documento a cada mudança em autenticação, execução remota, agente ou cadeia de build, e ao menos a cada
seis meses.
