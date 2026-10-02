# 0007 — CSP estrita sem recursos externos

**Estado:** aceito

## Contexto
O cliente importava fontes do Google por URL; isso vazava IPs de usuários a terceiros e impede uma CSP restritiva.

## Decisão
Política: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'` (ver `vercel.json` e
`client/nginx.conf`; a API responde com CSP `default-src 'none'`). Fontes são auto-hospedadas (`@fontsource`). Nenhum
script, estilo ou fonte vem de CDN. Um teste e2e carrega o app sob essas mesmas políticas e falha com qualquer violação.

## Consequências
- (+) Superfície de XSS e vazamento reduzida; sem dependência de terceiros em tempo de execução.
- (−) `style-src 'unsafe-inline'` permanece por causa de estilos inline do React/bibliotecas (risco residual baixo,
  documentado no [modelo de ameaças](../MODELO-DE-AMEACAS.md)).
