# Política de segurança

## Versões suportadas
Recebe correções de segurança a versão em `main`. Não há versões legadas mantidas em paralelo.

## Como reportar uma vulnerabilidade
**Não abra uma issue pública.** Use o relato privado do GitHub: aba **Security → Report a vulnerability** deste
repositório (GitHub Private Vulnerability Reporting). Inclua: versão/commit, passos para reproduzir, impacto e, se possível,
uma sugestão de correção. Dados reais de clientes não devem ser anexados.

> Para o mantenedor: habilite *Private vulnerability reporting* em **Settings → Code security** para que o canal acima
> funcione.

Compromisso de resposta: confirmação em até 3 dias úteis e plano de correção em até 10 dias úteis para falhas
confirmadas. Falhas críticas (execução remota de código, bypass de autenticação) têm prioridade sobre qualquer outra
entrega.

## Escopo
Dentro do escopo: API, cliente web, agente Windows, instalador, scripts de implantação, configuração de CI/CD.
Fora do escopo: ataques que exijam acesso físico/administrador já comprometido à máquina do alvo, engenharia social,
negação de serviço volumétrica, vulnerabilidades em dependências já reportadas upstream sem exploração específica aqui.

## O que já existe
Modelo de ameaças em [docs/MODELO-DE-AMEACAS.md](docs/MODELO-DE-AMEACAS.md); sessões, MFA e política de senha em
[docs/IDENTIDADE-E-SESSAO.md](docs/IDENTIDADE-E-SESSAO.md); confiança do agente em
[docs/SEGURANCA-DO-AGENTE.md](docs/SEGURANCA-DO-AGENTE.md); operação e alertas em
[docs/OBSERVABILIDADE.md](docs/OBSERVABILIDADE.md).

## Boas práticas de implantação (resumo)
- `JWT_SECRET` aleatório (≥32 caracteres), `SETUP_TOKEN` para o primeiro admin, `MFA_REQUIRED_FOR_ADMINS=true`.
- `DB_SSL_CA` configurada para verificar o certificado do banco.
- `METRICS_TOKEN` e `CRON_SECRET` aleatórios; `/metrics` não exposto à internet.
- Chaves de assinatura do agente geradas com `npm run agent:keys`; a de **release** fora do servidor.
- Nunca ligar dados de demonstração (`ENABLE_DEMO_SEED`) em produção.
