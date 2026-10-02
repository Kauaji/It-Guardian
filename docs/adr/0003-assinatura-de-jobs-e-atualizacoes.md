# 0003 — Assinatura de jobs e atualizações do agente

**Estado:** aceito

## Contexto
O agente Windows executa scripts e se auto-atualiza a partir de respostas do servidor. O hash do binário de atualização
vinha na mesma resposta que a URL: quem controlasse o servidor ou o TLS entregaria código arbitrário a todos os agentes.

## Decisão
ECDSA P-256/SHA-256 (assinatura P1363). Duas chaves: **release** (assina o manifesto de atualização; privada fora do
servidor da API) e **jobs** (assina cada job entregue; privada no servidor). O agente guarda as públicas, reconstrói a
mensagem a partir dos campos recebidos e verifica antes de baixar/executar. Jobs têm validade (15 min), amarram o ativo e o
hash do conteúdo, e o agente rejeita replay (últimos 500 ids). Padrão seguro: sem chave configurada o agente **não**
atualiza nem executa jobs, salvo opt-out explícito no config local. A verificação é implementada com `BigInteger`
(autocontida) para ser idêntica no Windows e testável sob Mono, validada contra 240 vetores gerados pelo Node.

## Consequências
- (+) Servidor comprometido não consegue empurrar executável (chave de release fora dele); jobs adulterados no
  caminho/banco são recusados.
- (−) Quem controla o servidor **e** a chave de jobs ainda cria jobs válidos (limitado aos scripts aprovados e às flags
  de execução remota dos dois lados).
- (−) Exige gerar/guardar chaves e distribuir a pública (instalador/ativação).
Detalhes: [SEGURANCA-DO-AGENTE.md](../SEGURANCA-DO-AGENTE.md).
