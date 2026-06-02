# Auditoria Geral de Código

Data: 02/06/2026

## Resumo

Foi feita uma rodada segura de auditoria após as migrações recentes para backend, com foco em estabilidade, textos PT-BR, permissões, Ordens de Serviço e Inventário. Não foram criadas funcionalidades novas nem iniciada migração grande de Inventário.

O build de produção passou com sucesso. A checagem sintática dos arquivos rastreados do backend também passou.

## Correções aplicadas

- Corrigidos textos visíveis sem acento ou com grafia inadequada em permissões, tela pública de abertura de chamado, ficha da máquina, inventário e mensagens de Ordens de Serviço.
- Ajustado o campo “É uma OS de terceiros?” no formulário de criação de OS para funcionar visualmente como checkbox compacto, não como botão grande.
- Mantido o solicitante como seletor de técnicos cadastrados; quando a OS é de terceiros, o campo passa a aceitar o nome do solicitante real.
- A categoria da criação de OS agora usa o mesmo conjunto de tipos de ativo do Inventário.
- O seletor de máquina/ativo da OS exibe contexto de grupo/segmento quando disponível.
- Removida uma dependência instável no carregamento de técnicos/clientes do modal de criação de OS, evitando chamadas repetidas quando a função de notificação muda de referência.
- Ajustada mensagem de erro de conexão com o servidor para PT-BR correto.

## Validações executadas

- `npm run build` executado com sucesso.
- `node --check` executado nos arquivos JavaScript rastreados do backend, sem erros.
- Varredura em `client/src` por mojibake (`Ã`, `Â`, `�`) sem ocorrências restantes.
- Varredura em `client/src` por termos visíveis comuns sem acento, como `Inventario`, `Servico`, `Maquina`, `Nao`, `Historico`, `Permissoes`, sem ocorrências restantes.
- Revisão rápida das rotas do backend confirmou uso de `requireAuth`, `requirePermission` ou `requireAdmin` nas rotas sensíveis principais.

## Achados por prioridade

### Crítico

- Nenhum erro crítico confirmado nesta rodada.
- Build e sintaxe do backend passaram.

### Alto

- O bundle principal do Vite continua acima de 500 kB após minificação. Não quebra a aplicação, mas deve ser tratado depois com code splitting.
- `App.jsx` permanece grande e concentra muita lógica de Inventário, OS, manutenção e backup. Não foi refatorado para evitar risco nesta fase.
- Ainda há uso de `localStorage` para preferências visuais e também para alguns estados de Inventário, como alias, observações, histórico de periféricos e registros locais de manutenção. Parte disso deve migrar em etapa futura.

### Médio

- Existem arquivos não rastreados ligados a abas/ambientes e ciclo de vida de ativos no backend. Eles não foram incluídos nesta correção porque parecem pertencer a uma migração maior de Inventário.
- A tentativa de validação visual pelo navegador integrado foi bloqueada pelo cliente do navegador com `ERR_BLOCKED_BY_CLIENT`. A validação ficou coberta por build e inspeções estáticas nesta rodada.

### Baixo

- A documentação antiga ainda contém trechos sem acentuação por histórico do projeto. Como não são textos de interface, não foram alterados em massa nesta rodada.

## Riscos restantes

- Inventário ainda mistura estado local e backend em algumas regras operacionais.
- Manutenção/backup ainda precisam de consolidação completa no backend.
- Drag-and-drop e fluxo de impressão ainda dependem de validação manual assistida.
- O tamanho do bundle pode impactar carregamento inicial em máquinas mais fracas.

## Recomendações

1. Tratar code splitting do frontend antes de novas telas grandes.
2. Planejar migração segura de manutenção/backup e abas/ambientes do Inventário para backend.
3. Separar gradualmente partes de `App.jsx` apenas quando houver teste ou fluxo claro para evitar regressão.
4. Manter a regra “frontend exibe, backend decide” para OS, permissões e configurações já migradas.
