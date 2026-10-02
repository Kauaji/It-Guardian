# 0006 — Suíte de integração em pg-mem e PostgreSQL real

**Estado:** aceito

## Contexto
O pg-mem é rápido e sem dependências, mas aceita/rejeita SQL de forma diferente do PostgreSQL; já escondeu um 500 real
(parâmetro sem tipo) e rejeita construções válidas.

## Decisão
Cada arquivo de teste de integração usa `useTestDatabase()`: um banco isolado por arquivo, em pg-mem por padrão ou em
PostgreSQL real quando `TEST_PG_ADMIN_URL` está definido. O CI roda a suíte nos dois (matriz). Divergência → o PostgreSQL
vence; testes que dependem de comportamento transacional real (rollback, concorrência) rodam só nele.

## Consequências
- (+) Feedback local rápido e garantia contra o motor de produção.
- (−) Tempo de CI maior; pequenas adaptações de SQL para agradar os dois motores.
