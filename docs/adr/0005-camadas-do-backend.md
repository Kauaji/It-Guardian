# 0005 — Camadas do backend verificadas no CI

**Estado:** aceito

## Contexto
Repositórios de 2.000+ linhas misturavam SQL, regras e orquestração, difíceis de testar e de revisar.

## Decisão
`domain/` (regras puras: sem banco, rede, ambiente) → `repositories/` (só SQL e mapeamento) → `services/`
(orquestração, transações) → `controllers/` (HTTP, sempre via serviços) → `routes/`. `scripts/check-architecture.mjs`
falha o CI para imports que violem o sentido das camadas, ciclos e primitivas perigosas (`child_process`, `eval`...).
Arquivos antigos que muitos módulos importam viram *barris* de reexportação.

## Consequências
- (+) Regras testáveis sem banco; revisões menores; dependências explícitas.
- (−) Mais arquivos; barris exigem disciplina para não virarem um novo depósito.
Detalhes: [ARCHITECTURE.md](../ARCHITECTURE.md).
