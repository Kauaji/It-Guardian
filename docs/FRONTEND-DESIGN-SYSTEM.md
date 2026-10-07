# Design System Interno do IT Guardian

## Principios

1. Interface operacional antes de interface demonstrativa.
2. Densidade com leitura clara.
3. Cores fortes apenas para acao, status e risco.
4. Cards e paineis com borda discreta, sombra curta e raio moderado.
5. Um mesmo tipo de acao deve ter a mesma aparencia em todos os modulos.

## Tokens Visuais

### Superficies

- `--app-bg`: fundo geral da aplicacao.
- `--surface`: paineis, cards e modais.
- `--surface-soft`: areas secundarias e campos agrupados.
- `--surface-muted`: estados neutros e backgrounds suaves.

### Texto

- `--text-strong`: titulos, numeros e informacoes principais.
- `--text`: texto padrao.
- `--text-muted`: labels e metadados.
- `--text-soft`: descricoes e textos auxiliares.

### Bordas e Sombra

- `--border`: divisores e bordas padrao.
- `--border-soft`: bordas internas mais leves.
- `--border-strong`: foco, selecao e limites importantes.
- `--shadow-sm`: elevacao curta para cards e botoes.
- `--shadow-md`: elevacao de hover ou modal leve.

### Acao

- `--accent`: acao primaria e confirmacao.
- `--accent-strong`: texto ou borda de destaque.
- `--primary-button-bg`: fundo de botoes primarios.
- `--primary-button-hover`: hover primario.

### Status

- Verde: online, sucesso, ativo.
- Ambar: atencao, risco medio, aguardando.
- Vermelho: erro, critico, falha, recusa.
- Azul: informacao, processamento, selecao.
- Cinza: neutro, indisponivel, desativado.

## Componentes Padrao

### PageHeader

Usado para titulo de tela, contexto curto e acoes principais. Evitar textos longos. Acoes devem ficar alinhadas a direita em desktop e quebrar bem no mobile.

### Panel

Base visual para secoes principais:

- fundo `--surface`;
- borda `--border`;
- raio de 8px;
- sombra curta;
- padding consistente.

### SummaryCard

Usado para metricas. Deve ser compacto, com label pequeno e numero em bloco. Evitar numeros gigantes fora de contexto.

### Button

- Primario: acao principal positiva.
- Secundario: navegacao, filtros, abrir paineis.
- Perigo: exclusao, recusa ou desativacao.
- Iconico: acoes compactas com tooltip ou `aria-label`.

Todos devem ter foco visivel, raio moderado e altura minima previsivel.

### StatusBadge

Pilulas pequenas para estado, prioridade e categoria. Usar no maximo quando o status ajuda a decisao. Evitar transformar todo texto em badge.

### Modal

Modais grandes ficam acima da sidebar, com backdrop bloqueando interacao de fundo. Conteudo longo deve rolar dentro do modal.

## Regras de Uso

- Nao usar gradientes decorativos em telas internas.
- Nao usar glassmorphism ou blur como decoracao.
- Nao criar novo padrao visual para cada modulo.
- Cards de Avisos, OS, Preventivas e Automacao devem compartilhar linguagem.
- Status deve ser consistente entre Dashboard, Inventario, OS e Avisos.
- Preferir truncamento controlado a cards de altura variavel em listas densas.

## Acessibilidade e idioma

Meta: WCAG 2.1 A/AA nas telas principais, nos fluxos de identidade e nos modais, sem violações `serious`/`critical` do axe.

- **Idioma e acentos.** Todo texto visível (JSX, `aria-label`, `title`, `placeholder`, mensagens de erro/aviso, rótulos) é escrito em português correto, com acentos. Identificadores, chaves de objeto, classes CSS, rotas (`/ordens-de-servico`), valores enviados à API e enums continuam sem acento. `npm run check:accents` (`scripts/check-ui-accents.mjs`) falha o CI se uma lista curada de termos aparecer sem acento em literais de interface; casos legítimos recebem o comentário `accents-ok` na linha. O HTML declara `lang="pt-BR"` e `document.title` muda por rota ("Avisos · IT Guardian").
- **Cor e contraste.** Texto normal precisa de 4,5:1; texto grande e componentes de interface (borda de campo, anel de foco, ícones) de 3:1, nos dois temas. Use os tokens de texto (`--text`, `--text-muted`, `--text-soft`, `--text-info/ok/warn/danger`) em vez de hex soltos; `--text-soft` (eyebrow, subtítulo da topbar, placeholder) vale 5,1:1 sobre a página. Botões sobre o acento usam `--on-accent` (branco no claro, verde-escuro no escuro). `npm run check:contrast` (`scripts/check-contrast.mjs`) valida os pares de tokens sem navegador; `client/src/a11y/contrast.a11y.test.jsx` mede o texto real das telas e modais com as folhas de estilo completas, nos dois temas.
- **Estrutura.** Um `<main id="conteudo-principal" tabindex="-1">`, um `<header>`, `<nav aria-label>` e um único `<h1>` por tela. O primeiro foco é o link "Pular para o conteúdo". Controles interativos nunca ficam dentro de outros (ex.: aba do inventário = botão seletor + menu de ações irmãos). Todo `<select>`/`<input>` tem rótulo (`<label>` ou `aria-label`); `placeholder` não é rótulo.
- **Teclado e foco.** Modais usam `useModalLifecycle` (Escape fecha, Tab fica preso, foco volta ao disparador) com `role="dialog"`, `aria-modal` e nome (`aria-label`/`aria-labelledby`). Menus (`UserMenu`) navegam por setas/Home/End/Escape. O anel `:focus-visible` global (`--focus-outline`, 3px) vale para todos os controles; não remova `outline` sem substituto. `prefers-reduced-motion` desliga animações e transições globalmente.
- **Como medir sem navegador.** `client/src/a11y/*.a11y.test.jsx` montam as visões reais com dados mockados e rodam `axe.run` (WCAG 2.1 A/AA; `color-contrast` é desligado no jsdom e coberto pelos testes de contraste acima), além dos testes de teclado/foco. O e2e `tests/e2e/a11y.spec.js` roda o axe completo no navegador (CI). O que só um navegador real confirma: contraste sobre gradientes/imagens e sobreposições, cálculo de layout (alvos de toque, `scrollable-region-focusable`), foco visual real, leitores de tela e zoom/reflow.

## Proximas Evolucoes

- Extrair componentes reutilizaveis de `App.jsx`.
- Criar arquivo CSS por modulo depois que a base visual estabilizar.
- Criar guia visual com screenshots aprovados pelo usuario.
