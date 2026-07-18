# Módulo de concursos e simulados

Este documento descreve a camada adicionada ao IT Guardian para estudo de concursos, sem substituir as funcionalidades já existentes de monitoramento, inventário, avisos e ordens de serviço.

## Análise da arquitetura atual

- Frontend: React + Vite em `client/src`, com SPA renderizada em `App.jsx`.
- Backend: Express em `server/src/app.js`, exposto localmente por `server/src/server.js` e no Vercel por `api/index.js`.
- Banco: PostgreSQL por `DATABASE_URL`; em desenvolvimento pode usar `DATABASE_URL=memory` com `pg-mem`.
- Migrations: `server/src/migrations/index.js`.
- Bootstrap: `server/src/bootstrap.js`, executado de forma idempotente.
- Usuários/autenticação: tabela `users`, senha com bcrypt, JWT/cookie HttpOnly, login em `/api/auth/login`.
- Progresso anterior do IT Guardian: preferências e dados operacionais ficam em tabelas próprias; o novo módulo usa tabelas `study_*`, isoladas.

Antes desta alteração, não havia banco de questões, concursos, simulados ou progresso de estudos.

## Arquivos criados

- `server/src/migrations/003-study-contests.js`
- `server/src/data/studyContestSeed.js`
- `server/src/repositories/studyContestRepository.js`
- `server/src/controllers/studyContestController.js`
- `server/src/routes/studyContestRoutes.js`
- `client/src/components/study/StudyContestModule.jsx`
- `docs/CONCURSOS-SIMULADOS.md`

## Arquivos alterados

- `server/src/migrations/index.js`
- `server/src/bootstrap.js`
- `server/src/app.js`
- `server/src/repositories/userRepository.js`
- `server/src/controllers/authController.js`
- `server/src/middleware/authMiddleware.js`
- `client/src/api.js`
- `client/src/App.jsx`
- `client/src/components/auth/AuthScreen.jsx`
- `client/src/styles.css`

## Tabelas/migration adicionadas

Migration: `003-study-contests`

Tabelas:

- `study_contests`
- `study_roles`
- `study_subjects`
- `study_questions`
- `study_user_answers`
- `study_question_favorites`
- `study_exam_attempts`

Também foi adicionado o campo `username` na tabela `users`, para permitir login por nome de usuário além de e-mail.

## Concursos cadastrados

### CRT-SP

- Cargo principal: Técnico Administrativo — Baixada Santista.
- Banca: Quadrix.
- Data da prova: 02/08/2026.
- Questões iniciais: 100.
- Formato do simulado: Certo/Errado.
- Foco: Técnico Administrativo, com conteúdo compatível para Fiscal quando aplicável.

### IBGE

- Cargo principal: Agente Censitário de Qualidade.
- Seção separada: Analista Censitário — TI, Desenvolvimento e Ciência de Dados.
- Banca: Instituto Avalia.
- Data da prova: 30/08/2026.
- Questões iniciais: 150.
  - 100 para ACQ.
  - 50 para Analista TI/Dados.
- Formato do simulado: múltipla escolha com 5 alternativas.

### Prefeitura de Santos

- Cargo principal: Oficial de Administração.
- Banca: IBAM.
- Data da prova objetiva/redação: 27/09/2026.
- Questões iniciais: 100.
- Formato do simulado: múltipla escolha.

Total inicial: 350 questões.

## Origem das questões

Todas as questões iniciais foram cadastradas como:

```text
origem: inedita
```

Elas foram geradas a partir do conteúdo programático oficial e do estilo da banca. Não foram copiadas questões de provas reais nem de sites privados.

Cada questão possui:

- `id`;
- concurso;
- cargo;
- matéria;
- assunto;
- enunciado;
- alternativas;
- resposta correta;
- explicação;
- dificuldade;
- banca de referência;
- ano de referência;
- fonte;
- link da fonte;
- origem (`real`, `adaptada` ou `inedita`).

## Usuário de teste

Usuário:

```text
username: mequis
nome: Mequis
email: mequis@itguardian.local
senha: Mequis!2026
```

O login aceita tanto `mequis` quanto `mequis@itguardian.local`.

Esse usuário é criado pelo seed demo (`ENABLE_DEMO_SEED=true`) e não remove nem altera os usuários existentes.

## Como executar localmente

Instale dependências:

```bash
npm install
```

Para ambiente demo em memória, configure:

```env
DATABASE_URL=memory
JWT_SECRET=uma-chave-local-grande
ENABLE_DEMO_SEED=true
```

Suba a API:

```bash
npm run dev:server
```

Suba o frontend:

```bash
npm run dev:client
```

Ou rode o build completo:

```bash
npm run build
```

## Como executar migrations

As migrations rodam automaticamente no bootstrap do servidor:

```bash
npm run dev:server
```

Em produção, garanta `DATABASE_URL` apontando para PostgreSQL válido. O projeto não usa `DATABASE_URL=memory` em produção.

## Como cadastrar novos concursos

Edite `server/src/data/studyContestSeed.js`:

1. Adicione um item em `studyContestSeed.contests`.
2. Adicione um ou mais cargos em `studyContestSeed.roles`.
3. Adicione matérias no array `subjectSpecs`.
4. Defina `count`, `syllabus`, `topics`, `misconceptions`, banca e fonte oficial.
5. Reinicie o servidor para o bootstrap aplicar o seed idempotente.

## Como importar novas questões

O caminho atual é pelo seed em `server/src/data/studyContestSeed.js`.

Para importar questões reais futuramente, recomenda-se criar script dedicado em `scripts/` que leia CSV/JSON e grave em `study_questions`, sempre preenchendo:

- `origin_type = real`, se a questão vier de prova pública oficial;
- `origin_type = adaptada`, se houver reescrita baseada em prova oficial;
- `origin_type = inedita`, se criada com base no edital.

Nunca marcar como real sem fonte oficial.

## Como criar novos usuários

Opções:

1. Pelo painel Admin existente, em Configurações > usuários.
2. Pelo seed demo em `server/src/repositories/userRepository.js`.
3. Futuramente, por migration/script dedicado se for necessário criar usuários em massa.

## Isolamento de estatísticas

As respostas, favoritos e tentativas usam sempre:

```text
user_id + contest_id + role_id + question_id
```

Assim, acertos do CRT-SP não entram no IBGE, nem em Prefeitura de Santos.

## Fontes utilizadas

- Quadrix — CRT-SP 2026: `https://quadrix.org.br/informacoes/3048/`
- Edital CRT-SP nº 1/2026 — PDF oficial disponibilizado pelo Quadrix.
- IBGE PSS nº 02/2026 — Edital de Abertura: `https://ftp.ibge.gov.br/edital/PSS_Censo_Agro/2026_02/Edital_2_2026_AC_ACQ_Edital_de_Abertura.pdf`
- IBGE PSS nº 02/2026 — Conteúdos Programáticos: `https://ftp.ibge.gov.br/edital/PSS_Censo_Agro/2026_02/Edital_2_2026_AC_ACQ_Conteudos_Programaticos.pdf`
- Instituto Avalia — página do concurso IBGE: `https://www.avalia.org.br/concursos/618`
- IBAM — Santos Edital nº 71/2026: `https://www.ibamsp-concursos.org.br/informacoes/176/`
- Prefeitura de Santos — notícia oficial do concurso 2026.

## Limitações conhecidas

- As questões iniciais são inéditas e autorais, não questões reais importadas.
- O simulado da Prefeitura de Santos foca prova objetiva; a redação é indicada nos metadados, mas não há corretor de redação.
- Ainda não existe importador CSV/JSON com validação automática de fonte.
- A seção de IBGE Analista agrupa TI, Desenvolvimento e Ciência de Dados em uma trilha única de teste.
- A interface de estudo foi adicionada ao IT Guardian; se o objetivo for um produto separado de simulados, o ideal é separar em outro repositório/app.
