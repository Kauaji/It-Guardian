# Scripts de manutencao: seguranca e escopo

> Estado da beta: execucao real desligada. O padrao e simulacao, registro e
> auditoria. `ENABLE_REMOTE_SCRIPT_EXECUTION=false` impede criar e entregar jobs.

## Objetivo

O IT Guardian cadastra, analisa, recomenda, agenda e audita scripts de
manutencao. Nesta beta essas operacoes nao executam comandos. O codigo de fila
permanece para compatibilidade futura, protegido por flags no servidor e no
coletor. O navegador e o servidor nao abrem shell no endpoint.

## Tipos e fluxo

- tipos executaveis no coletor: BAT, CMD e PowerShell;
- Shell e Outro podem permanecer cadastrados, mas nao sao entregues ao Windows;
- sugestoes, preventivas e automatizacoes mantem registro/simulacao quando a
  execucao real esta desabilitada;
- o heartbeat autenticado entrega no maximo um trabalho pendente para a propria
  maquina;
- o coletor devolve status, saida limitada e erro;
- resultado, auditoria e historico da maquina sao atualizados.

## Limites de seguranca

- script precisa existir no cadastro e estar vinculado ao trabalho;
- token Bearer identifica enrollment e maquina;
- executaveis do Windows sao definidos pelo coletor;
- `UseShellExecute=false`;
- timeout limitado entre 15 e 600 segundos;
- saida combinada limitada a 64 KiB;
- requisitos de administrador e usuario logado sao validados;
- arquivo temporario e removido ao final;
- nao ha terminal interativo, WinRM, SSH, PsExec ou download de codigo;
- `eval`, `new Function`, `shell: true` e criacao dinamica de ScriptBlock nao
  sao usados.

## Analise e confirmacao

A analise de texto e heuristica e nao substitui revisao tecnica. Scripts de
risco alto ou critico exigem as confirmacoes configuradas. O resumo deve deixar
claro que analisar ou cadastrar nao executa o conteudo.

## Persistencia

- `maintenance_scripts`: definicao e metadados;
- `script_execution_logs`: intencao, estado e resultado;
- `agent_script_jobs`: fila por maquina, script e origem operacional;
- historico da maquina: evento consultavel pelo Inventario;
- auditoria: usuario, origem, maquina, script, datas e resultado.

## Endpoints do coletor

O heartbeat autenticado pode devolver um trabalho. O resultado e enviado para a
rota autenticada do proprio trabalho. Rotas administrativas de cadastro nao
aceitam comando arbitrario nem caminho de executavel.

## Checklist

- [x] Execucao real desabilitada por padrao no backend, frontend e coletor.
- [x] Fila persistente e idempotente.
- [x] Trabalho vinculado a maquina e enrollment.
- [x] Tipos executaveis em lista fechada.
- [x] Executaveis fixos e sem shell implicito.
- [x] Timeout e limite de saida.
- [x] Resultado, auditoria e historico.
- [x] Testes sem executar BAT, CMD ou PowerShell operacional.
- [ ] Assinatura criptografica de scripts antes de distribuicao publica.
- [ ] Homologacao em maquina virtual limpa com um script de baixo risco.
