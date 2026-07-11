# Qualidade do sistema

## Objetivo

Esta rodada reduz risco operacional sem trocar a stack, redesenhar o produto ou
alterar as regras centrais. O backend continua sendo a fonte da verdade.

## Barreiras automatizadas

- `npm run lint`: regras estáticas de JavaScript e React.
- `npm run check:architecture`: ciclos locais e primitivas proibidas.
- `npm test`: regras unitárias, contratos e integração HTTP.
- `npm run test:coverage`: pisos de cobertura definidos no workspace.
- `npm run test:e2e`: login e fluxos críticos em navegador isolado.
- `npm run build`: compilação de produção.
- `npm audit`: dependências conhecidas como vulneráveis.

## Confiabilidade implementada

- sessão em cookie HttpOnly e remoção de tokens legados do Web Storage;
- validação de origem para mutações autenticadas por cookie;
- limite de login e tamanho de corpo;
- request id, logs estruturados e health check do banco;
- migrações versionadas, transacionais e protegidas por advisory lock;
- preferência de inventário persistida no backend;
- aceite de sugestão de OS idempotente;
- rejeição de sugestão compatível com PostgreSQL e banco de testes;
- escopo de máquinas aplicado a criação, edição, override e detalhe de
  automações quando as restrições existem no usuário;
- histórico de automação por máquina.

## Dívida restante

- concluir a persistência administrativa de escopos por grupo e segmento;
- converter o bootstrap legado restante em migrações históricas;
- decompor `AlertCenterV2.jsx` e o CSS global de forma incremental;
- aumentar cobertura de integração em PostgreSQL real;
- ampliar testes visuais de responsividade e tema.

Esses itens não impedem o uso atual, mas devem ser tratados antes de uma
operação multiempresa ou de uma liberação comercial.
## Complemento desta rodada

- pausa e reativacao de automacoes foram separadas da edicao comum do plano;
- agenda de automacao passou a aplicar escopo antes de contagem e paginacao;
- filtros de maquinas, planos e agenda foram separados no frontend;
- indices idempotentes foram acrescentados para planos ativos/excluidos, agendas ativas por data e overrides por alvo;
- o escopo continua limitado pelos campos realmente existentes no usuario e nos ativos; em modo local/demo sem metadados de escopo, a visibilidade de ativos permanece compativel com o uso atual, enquanto planos seguem restricao por proprietario ou escopo compativel.
