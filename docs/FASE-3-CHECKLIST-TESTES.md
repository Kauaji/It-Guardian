# Fase 3 - Checklist de Testes

## Build

- [ ] Rodar `npm install`, se necessario.
- [x] Rodar `npm run build`. Validado em 29/05/2026.
- [x] Corrigir erros de import, sintaxe ou build. Nenhum erro restante no build final.
- [ ] Avaliar code splitting futuro: Vite ainda alerta que o chunk principal passa de 500 kB.

## Auditoria automatizada - 29/05/2026

- [x] `GET /api/health` respondeu `ok`.
- [x] Criar OS pela API.
- [x] Numero da OS foi gerado no backend: `OS-0005`.
- [x] Status inicial configurado aplicado pelo backend.
- [x] Tecnico, prioridade, ativo e item foram alterados pela API.
- [x] Status final registrou `closed_at`.
- [x] Historico da OS registrou eventos do fluxo.
- [x] Modo Local/Business foi lido e salvo via `/api/system-settings`, depois restaurado.
- [x] Usuario inativo recebeu bloqueio de login.
- [x] Usuario sem permissao recebeu `403` em inventario e usuarios.
- [x] Inventario respondeu dispositivos, segmentos, grupos, detalhe da maquina e rota publica de QR.
- [x] Ambiente de producao bloqueia `DATABASE_URL=memory`.
- [x] Ambiente de producao bloqueia `JWT_SECRET` inseguro.
- [x] Navegador abriu login, painel autenticado, Ordens de Servico, Configuracao da OS e Configuracoes Gerais sem erros de console.
- [x] OS temporarias da auditoria (`OS-0005` e `OS-0006`) foram removidas ao final do teste.

## Login e permissoes

- [ ] Login com `admin@itguardian.local`.
- [ ] Login com tecnico N1.
- [ ] Login com tecnico N2.
- [ ] Login com usuario comum.
- [ ] Login com usuario sem permissao.
- [ ] Usuario sem permissao ve mensagem amigavel ao acessar modulo bloqueado.
- [ ] API bloqueia usuario sem permissao.
- [ ] Admin acessa Admin.
- [ ] Usuario comum nao acessa Admin.
- [ ] Nao permitir desativar o ultimo admin ativo.

## Modo Local

- [ ] Alterar sistema para Modo Local.
- [ ] Criar OS sem cliente.
- [ ] OS usa setor.
- [ ] Aba Clientes nao aparece nas Configuracoes da OS.
- [ ] Cards destacam setor.
- [ ] Filtro por setor funciona.

## Modo Business

- [ ] Alterar sistema para Modo Business.
- [ ] Aba Clientes aparece nas Configuracoes da OS.
- [ ] Criar OS com cliente.
- [ ] Cliente aparece em cards/detalhes.
- [ ] Tecnico com clientes permitidos ve apenas OS permitidas.

## Ordens de Servico

- [ ] Criar OS.
- [ ] Numero gerado no backend.
- [ ] Formato do numero respeita prefixo/ano/mes.
- [ ] Selecionar servico.
- [ ] Valor do servico aparece quando cadastrado.
- [ ] Alterar prioridade.
- [ ] Prioridade automatica funciona.
- [ ] Mudar status.
- [ ] Status final registra `closed_at`.
- [ ] Historico registra eventos.
- [ ] Adicionar peca/produto.
- [ ] Excluir OS com confirmacao.

## Configuracoes da OS

- [ ] Abrir Configuracao da OS sem tela branca.
- [ ] Geral abre com accordions fechados.
- [ ] Formato do numero salva.
- [ ] Prioridade automatica salva.
- [ ] Cores das prioridades salvam.
- [ ] Status limita a 10.
- [ ] Status inicial unico.
- [ ] Status final unico.
- [ ] Servicos criam codigo `SRV-0001`.
- [ ] Produtos/pecas salvam.
- [ ] Tecnicos salvam.
- [ ] Tipos de problema salvam.

## Inventario

- [ ] Abas carregam.
- [ ] Grupos carregam.
- [ ] Segmentos carregam.
- [ ] Nao organizadas aparece.
- [ ] Backup aparece.
- [ ] Manutencao aparece quando existe maquina em manutencao.
- [ ] Drag-and-drop move maquina.
- [ ] Drag para sidebar nao trava de forma perceptivel.
- [ ] Selecao multipla funciona.
- [ ] Ficha da maquina abre.
- [ ] Historico aparece.
- [ ] QR Code imprime.

## Configuracoes Gerais

- [ ] Usabilidade salva tamanho de fonte.
- [ ] Aparencia aplica preset.
- [ ] Modo escuro mantem contraste.
- [ ] Cores customizadas nao afetam tela publica de abertura de chamado.
- [ ] Modo do sistema salva no backend.
- [ ] Admin lista usuarios sem expor emails na lista.
- [ ] Permissoes individuais ficam recolhidas por padrao.
