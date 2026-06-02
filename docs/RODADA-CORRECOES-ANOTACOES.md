# Rodada de correções das anotações

## Resumo

Rodada focada em correções seguras nas telas de Ordens de Serviço, Configurações Gerais e Configurações da OS, sem recriar módulos e sem alterar regras de backend já migradas.

## Itens atendidos

- Removido o campo "Observações iniciais" da criação de OS.
- No detalhe da OS, o bloco "Solicitação" agora aparece antes dos dados gerais.
- Campos de valores da OS no painel geral aparecem apenas no modo Business.
- Campo de valor no cadastro de serviços aparece apenas no modo Business.
- Campo "Valor do serviço" no atendimento aparece apenas no modo Business.
- Painel financeiro do atendimento aparece apenas no modo Business.
- Busca de serviços e peças no atendimento voltou a aceitar seleção por lista e digitação manual.
- Lista de sugestões de serviços/peças passa a abrir acima dos cards abaixo.
- Vínculo de máquina na OS agora inclui seletor de grupo entre aba/ambiente e segmento.
- Filtro mensal mantém OS abertas de meses anteriores visíveis até a finalização.
- Botão interno do filtro mensal perdeu a borda duplicada.
- Linhas de status da OS foram ajustadas para melhor alinhamento.
- Botões de editar/excluir em tabelas de configurações ficam visíveis na lateral direita.
- Aba "Conta e segurança" foi removida temporariamente das Configurações Gerais.
- Toggles de usabilidade sem função definida foram removidos.
- Checkbox "É uma OS de terceiros?" foi simplificado visualmente.
- Ajustado carregamento do `.env` da raiz pelo backend local, corrigindo falha de login local.

## Textos corrigidos

- Ajustes pontuais de PT-BR em labels de OS, status, placeholders e impressão.
- Mantidos nomes técnicos, rotas, chaves internas e entidades sem alteração.

## Pontos para teste manual

- Abrir criação de OS e confirmar que o campo de observações iniciais não aparece.
- Digitar serviço e peça no atendimento e validar lista/manual.
- Vincular máquina por aba, grupo e segmento.
- Alternar modo Local/Business e validar exibição de valores.
- Conferir visual das tabelas de configurações com rolagem horizontal.

## Verificação

- `npm run build` executado com sucesso.
- Permanece apenas o aviso de chunk grande do Vite, sem falha de build.
