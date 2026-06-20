# Auditoria Visual do Frontend

## Contexto

Esta auditoria registra a primeira leitura visual do IT Guardian antes da rodada de refinamento. A skill `frontend-design` foi carregada e usada como guia, com uma restricao importante para este projeto: o IT Guardian deve parecer uma ferramenta B2B de operacao tecnica diaria, nao uma landing page, template generico ou painel decorativo.

Esta rodada nao altera regras de negocio, rotas, APIs, permissoes, banco de dados, calculos ou contratos de dados.

## Direcao Recomendada

O sistema deve priorizar clareza, densidade controlada e confianca operacional. A assinatura visual sugerida e uma interface de "console tecnico": fundos neutros, paineis brancos, bordas discretas, verdes de acao, vermelhos/ambares apenas para status e uma hierarquia tipografica firme.

## Inconsistencias Encontradas

1. Tipografia
   - O projeto usa uma familia consistente, mas alguns titulos internos ainda competem em escala com cabecalhos de pagina.
   - Ha textos auxiliares longos em telas operacionais, reduzindo a leitura rapida.

2. Espacamento
   - Modais, paineis e cards usam espacamentos proximos, mas nao totalmente padronizados.
   - Algumas areas tem respiro excessivo enquanto listas operacionais ficam densas demais.

3. Cards
   - Cards de OS, sugestoes, preventivas, automacao e inventario usam padroes parecidos, mas com bordas, fundos e sombras diferentes.
   - Alguns cards possuem gradientes e efeitos que deixam a interface menos corporativa.

4. Botoes
   - Existem varios estilos para botoes primarios, secundarios, destrutivos e iconicos.
   - Alguns botoes de acao negativa parecem diferentes entre modulos.

5. Status
   - Verde, amarelo, vermelho, azul e cinza aparecem corretamente, mas com intensidades diferentes entre telas.
   - Algumas pilulas aparecem em excesso e viram ruido visual.

6. Contraste
   - O contraste geral e bom, mas fundos coloridos em cards podem competir com texto pequeno.
   - Em modo escuro, alguns elementos dependem muito de transparencia.

7. Hierarquia
   - Avisos, Preventivas e Automacao ganharam muitas acoes na mesma area, exigindo uma hierarquia visual mais clara.
   - Alguns modais mostram muitos blocos abertos ao mesmo tempo.

8. Responsividade
   - Ha boas bases responsivas, mas os cards densos precisam manter altura e truncamento previsiveis.
   - Popovers e menus precisam manter prioridade visual sobre cards proximos.

9. Aparencia de template
   - Sombras, gradientes e cards muito coloridos podem dar aparencia de dashboard gerado.
   - Acoes operacionais devem parecer ferramentas de trabalho, nao elementos de apresentacao.

## Oportunidades de Reutilizacao

- Usar os mesmos tokens para superficie, borda, sombra, foco e estados.
- Unificar botoes `.primary-action`, `.secondary-action`, `.danger-action`, `.icon-button` e `.compact-action`.
- Manter cards de OS como referencia visual, mas reduzir gradientes e exageros.
- Documentar um sistema interno leve em vez de instalar biblioteca visual nova.

## Primeira Rodada Aplicada

- Criar documentacao de auditoria e design system interno.
- Refinar tokens globais de cor, borda, sombra, foco e raio.
- Padronizar botoes e paineis em CSS.
- Reduzir aparencia decorativa dos cards de OS/sugestoes mantendo layout e comportamento.

## Pontos Para Rodadas Futuras

- Separar componentes visuais reutilizaveis fora de `App.jsx`.
- Quebrar `styles.css` por dominios sem mudar comportamento.
- Revisar modais grandes por tela com screenshots.
- Criar um inventario visual de estados: vazio, carregando, erro, bloqueado, sucesso.
