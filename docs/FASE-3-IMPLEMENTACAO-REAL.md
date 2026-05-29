# Fase 3 - Preparacao para Implementacao Real

## Estado atual

O IT Guardian ja tem base de backend para Fase 3:

- Express API centralizada.
- Bootstrap idempotente de tabelas.
- PostgreSQL por `DATABASE_URL`.
- Bloqueio de `DATABASE_URL=memory` em ambiente de producao.
- JWT com validacao de segredo seguro em producao.
- Permissoes em backend para inventario, OS e administracao.
- OS usando backend como fonte principal de numero, status, prioridade e historico.
- Endpoints explicitos de OS para prioridade, tecnico, ativo, itens, configuracoes e status.
- Numeracao de OS protegida por `UNIQUE` no banco e fila interna no processo da API.
- Modo Local/Business persistido em backend.
- Configuracoes de regra da OS persistidas no backend.
- Usuarios, setores e permissoes com bloqueio no backend.
- Seeds demo restritos a ambientes nao produtivos; producao nao recebe usuarios/senhas ficticias automaticamente.

## O que ainda nao e implementacao real

- OCS ainda usa mock.
- Zabbix ainda usa mock.
- Ping real ainda nao roda no Vercel.
- Coletor por cliente ainda nao existe.
- Abas/ambientes do inventario ainda dependem parcialmente de estado local.
- Manutencao/backup ainda precisam ser consolidados totalmente no backend.
- Preferencias visuais continuam no frontend por decisao de baixo risco.

## Auditoria final - 29/05/2026

Validacoes executadas contra a API local:

- `GET /api/health` respondeu `ok`.
- Criacao de OS gerou numero no backend: `OS-0005`.
- Status inicial aplicado pelo backend: `open`.
- Troca para status final registrou `closed_at`.
- Historico da OS registrou 7 eventos no fluxo auditado.
- Item de produto/peca foi gravado na OS.
- Modo Local/Business foi lido e alterado via `/api/system-settings`, depois restaurado.
- Usuario inativo recebeu bloqueio de login `401`.
- Usuario sem permissao recebeu `403` em inventario e usuarios.
- Inventario retornou 47 dispositivos, 6 segmentos e 3 grupos no smoke test.
- Detalhe de dispositivo e rota publica de QR responderam corretamente.
- Browser local abriu login, painel autenticado, Ordens de Servico, Configuracao da OS e Configuracoes Gerais sem erros de console.
- OS temporarias da auditoria foram removidas ao final do teste.

## Preparacao recomendada

### Banco

- Usar PostgreSQL real em todos os ambientes persistentes.
- Manter seed demo restrito a desenvolvimento/demo e criar fluxo formal para primeiro admin em producao real.
- Criar migration formal quando sair do MVP.
- Revisar indices para:
  - `service_orders.number`
  - `service_orders.status`
  - `service_orders.sector_id`
  - `service_orders.environment_id`
  - `service_order_history.service_order_id`
  - `device_metadata.device_id`

### Seguranca

- Definir `JWT_SECRET` longo e unico por ambiente.
- Usar HTTPS em producao.
- Manter CORS restrito a dominios conhecidos.
- Validar permissoes no backend em todas as rotas mutaveis.
- Evitar seeds demo em producao real.

### Coletor

Arquitetura recomendada para Business:

```txt
Cliente
  -> coletor local dentro da rede
  -> ping/OCS/Zabbix internos
  -> envio seguro para API central
  -> IT Guardian central
```

Evitar VPN geral entre clientes. O coletor reduz exposicao e limita acesso a rede interna de cada cliente.

## Checklist de estabilizacao

- `npm run build` passa.
- Login admin passa.
- Usuario sem permissao nao acessa modulos bloqueados.
- OS cria numero no backend.
- OS respeita status inicial/final configurado.
- OS registra historico.
- Modo Local oculta clientes na configuracao de OS.
- Modo Business mostra clientes.
- Inventario abre, move maquinas e exibe ficha.
- Configuracoes Gerais abrem sem tela branca.
- Tema claro/noturno nao quebra contraste.

## Proximos passos tecnicos

1. Reforcar numeracao de OS com lock transacional/advisory lock quando houver multiplas instancias da API.
2. Criar comando/rotina segura para primeiro administrador em producao real.
3. Migrar manutencao e backup para backend.
4. Migrar abas/ambientes do inventario para backend.
5. Implementar coletor local.
6. Trocar `OCS_MODE=mock` por modo real em ambiente controlado.
7. Trocar `ZABBIX_MODE=mock` por modo real em ambiente controlado.
8. Trocar `PING_MODE=mock` por modo real em VPS/coletor.
