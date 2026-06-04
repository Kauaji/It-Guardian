# Scripts de Manutenção: Segurança e Escopo

## Objetivo

Esta base prepara o IT Guardian para cadastrar, organizar e auditar scripts de manutenção. A versão atual é apenas preparatória: scripts são armazenados como texto, recebem uma análise estimada por heurística e podem gerar registros de simulação/intenção.

## O Que Existe Agora

- Cadastro, listagem, edição e desativação de scripts.
- Tipos permitidos: BAT, CMD, PowerShell, Shell e Outro.
- Classificação de risco: baixo, médio, alto e crítico.
- Resumo estimado gerado por padrões locais conhecidos.
- Vínculo opcional com tipo de aviso e tipo de problema.
- Registro de simulação com histórico de máquina, histórico de Ordem de Serviço e log de auditoria.
- Scripts demonstrativos em ambiente de desenvolvimento/demo para testes de registro seguro.
- Permissões específicas:
  - `scripts.view`
  - `scripts.manage`
  - `scripts.register_simulation`

## Scripts Demonstrativos

Quando os dados demo estiverem habilitados, o sistema cadastra roteiros básicos para teste:

- Diagnóstico básico de rede.
- Coleta básica do sistema.
- Verificação de impressora.
- Verificação de disco.

Esses itens servem apenas para testar listagem, seleção e registro de simulação. Selecionar um script pela tela de Avisos não executa comandos; a ação apenas cria um registro de simulação/auditoria.

## O Que Não Existe Nesta Etapa

O IT Guardian não executa scripts nesta versão.

Bloqueios de escopo:

- Não há execução real de BAT, CMD, PowerShell ou Shell.
- Não há agente local.
- Não há WinRM, SSH ou PsExec.
- Não há execução automática por aviso.
- Não há execução automática por Ordem de Serviço.
- Não há endpoint de execução, comando, shell ou execução remota.
- O conteúdo do script nunca é interpretado como instrução do sistema.

## Análise Estimada

A análise de script é local e baseada somente em palavras-chave e padrões conhecidos. Ela identifica sinais como:

- remoção de arquivos;
- limpeza de DNS;
- alteração de serviços;
- alteração no Registro do Windows;
- reinício/desligamento;
- formatação ou particionamento;
- coleta de informações básicas.

O resumo é apenas estimado. O técnico continua responsável pela revisão manual.

Mensagem de segurança aplicada:

> Resumo estimado gerado a partir de padrões conhecidos. Revise manualmente antes de usar. Nenhum comando foi executado.

## Armazenamento e XSS

O conteúdo é salvo como texto puro. No frontend, ele é renderizado por React dentro de `pre`, `textarea` ou texto escapado, sem `dangerouslySetInnerHTML`.

Limites atuais:

- nome: até 120 caracteres;
- descrição: até 500 caracteres;
- conteúdo: até 10.000 caracteres;
- categoria: até 80 caracteres.

## Registro de Simulação

Registrar simulação não executa comandos. A ação apenas cria registros.

Regras:

- exige confirmação visual;
- risco alto/crítico exige confirmação extra;
- backend bloqueia registro sem confirmação;
- histórico de máquina registra script, risco, resumo e observação;
- histórico da OS registra a simulação se houver OS vinculada;
- auditoria registra usuário, script, máquina, OS e aviso quando informados.

## Banco de Dados

Tabelas criadas:

- `maintenance_scripts`
- `script_execution_logs`

Observação: mesmo com o termo `execution_logs`, o status atual representa apenas simulação/intenção. Nenhuma execução real é feita.

## Endpoints

Endpoints disponíveis:

- `GET /api/maintenance-scripts`
- `POST /api/maintenance-scripts`
- `PATCH /api/maintenance-scripts/:id`
- `DELETE /api/maintenance-scripts/:id`
- `POST /api/maintenance-scripts/analyze`
- `POST /api/maintenance-scripts/:id/register-simulation`

Endpoints não criados:

- execute
- run
- remote-execute
- command
- shell

## Evolução Futura

Futuramente, o módulo poderá contar com execução remota por agente/coletor seguro. Antes da execução real, o sistema poderá exibir o resumo estimado do script, o nível de risco, a máquina de destino, o técnico responsável e solicitar confirmação explícita. A execução real dependerá de autenticação forte, autorização, auditoria, assinatura dos scripts e comunicação segura com o agente.

Essa etapa futura não foi implementada agora.

## Checklist de Segurança

- [x] Conteúdo tratado apenas como texto.
- [x] Sem `child_process`.
- [x] Sem `exec`.
- [x] Sem `spawn`.
- [x] Sem `eval`.
- [x] Sem `Function`.
- [x] Sem endpoint de execução real.
- [x] Backend valida permissões.
- [x] Backend exige confirmação para simulação.
- [x] Alto/crítico exige confirmação extra.
- [x] Histórico e auditoria deixam claro que nenhum comando foi executado.
