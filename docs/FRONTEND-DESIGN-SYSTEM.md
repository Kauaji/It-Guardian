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

## Proximas Evolucoes

- Extrair componentes reutilizaveis de `App.jsx`.
- Criar arquivo CSS por modulo depois que a base visual estabilizar.
- Criar guia visual com screenshots aprovados pelo usuario.
