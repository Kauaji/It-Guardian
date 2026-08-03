# Seguranca do IT Guardian Agent

## Estado seguro da beta

A execucao remota real fica desabilitada por padrao. O servidor somente cria e
entrega jobs quando `ENABLE_REMOTE_SCRIPT_EXECUTION=true`; o coletor ainda exige
`enableRemoteScriptExecution=true` em sua configuracao local. O instalador
comum grava `false`, portanto habilitar apenas um dos lados nao executa nada.

## Modelo de confianca

O agente e destinado a computadores administrados em uma LAN ou VPN. Ele envia
um payload de inventario para uma API conhecida usando token Bearer. Cada token
pertence a um enrollment e pode ser revogado.

## Protecoes implementadas

- token gerado com 256 bits aleatorios;
- somente hash SHA-256 e prefixo ficam no banco;
- token completo aparece uma unica vez na criacao;
- configuracao local acessivel apenas por `SYSTEM` e administradores;
- payload com lista fechada de campos;
- limites de tamanho e validacao de numeros, data e intervalo;
- enrollment inativo ou revogado recebe `401`;
- rotas do coletor tem rate limit por hash do token, sem guardar o token no limiter;
- coletor e servidor recusam inventario acima do limite de 1 MB;
- logs nao incluem o token;
- historico registra cadastro e reconexao do agente;
- desinstalacao remove tarefa, configuracao e logs locais;
- trabalhos de manutencao permanecem bloqueados na beta por padrao;
- tipos permitidos limitados a BAT, CMD e PowerShell cadastrados;
- executaveis do Windows sao fixos, sem `shell: true`;
- timeout entre 15 e 600 segundos e saida limitada a 64 KiB;
- requisitos de administrador e usuario logado sao validados;
- resultado, erro, auditoria e historico da maquina sao persistidos;
- teste automatico procura primitivas perigosas e coleta invasiva.

## O que nao existe

- shell interativo ou comando arbitrario enviado diretamente pela API;
- download de codigo para execucao;
- atualizacao automatica;
- captura de tela, teclado ou clipboard;
- coleta de arquivos, senhas ou navegacao;
- persistencia oculta;
- geolocalizacao;
- execucao sem script previamente cadastrado e trabalho persistido.

O coletor usa APIs locais de inventario e HTTPS para heartbeat. O codigo de
compatibilidade da fila nao oferece terminal remoto e somente pode operar com
as duas flags explicitas, alem das validacoes de cadastro, token e ativo.

## Transporte e rotacao

Em laboratorio isolado, HTTP pode ser usado com risco conhecido. Fora de uma LAN
confiavel, configure HTTPS ou uma VPN antes de instalar agentes. Nao exponha a
porta da API diretamente na internet.

Revogue e substitua o enrollment quando:

- um token for copiado para local inadequado;
- um administrador deixar a equipe;
- um PC for perdido;
- o laboratorio terminar.

Um enrollment pode atender varias maquinas de um mesmo laboratorio. Para maior
isolamento, use um enrollment por setor ou lote de instalacao.

## Resposta a incidente

1. Revogue o enrollment.
2. Pare e desinstale a tarefa nos clientes.
3. Examine `agent_enrollments.last_used_at` e os heartbeats.
4. Gere novo token somente apos corrigir a causa.
5. Preserve os logs e o historico do ativo para auditoria.
