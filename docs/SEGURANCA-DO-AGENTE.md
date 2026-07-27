# Seguranca do IT Guardian Agent

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
- logs nao incluem o token;
- historico registra cadastro e reconexao do agente;
- desinstalacao remove tarefa, configuracao e logs locais;
- teste automatico procura primitivas de execucao remota e coleta invasiva.

## O que nao existe

- shell, PowerShell ou CMD remoto;
- download e execucao de codigo;
- atualizacao automatica;
- captura de tela, teclado ou clipboard;
- coleta de arquivos, senhas ou navegacao;
- persistencia oculta;
- geolocalizacao;
- execucao de scripts de manutencao.

O agente usa PowerShell somente como runtime local e APIs CIM de inventario. A
unica chamada de rede operacional e `Invoke-RestMethod` para o endpoint de
heartbeat configurado.

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
