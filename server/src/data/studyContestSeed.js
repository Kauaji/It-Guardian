const LETTERS = ["A", "B", "C", "D", "E"];

const SOURCES = {
  crtsp: {
    title: "Edital CRT-SP nº 1/2026 — Quadrix",
    url: "https://quadrix.org.br/informacoes/3048/",
    referenceYear: 2026
  },
  ibge02: {
    title: "IBGE PSS nº 02/2026 — Edital de Abertura e Anexo III",
    url: "https://ftp.ibge.gov.br/edital/PSS_Censo_Agro/2026_02/Edital_2_2026_AC_ACQ_Edital_de_Abertura.pdf",
    referenceYear: 2026
  },
  santos71: {
    title: "Prefeitura de Santos — Edital nº 71/2026 — IBAM",
    url: "https://www.ibamsp-concursos.org.br/informacoes/176/",
    referenceYear: 2026
  }
};

export const studyContestSeed = {
  contests: [
    {
      id: "contest-crt-sp",
      slug: "crt-sp",
      name: "CRT-SP",
      primaryRole: "Técnico Administrativo — Baixada Santista",
      board: "Quadrix",
      examDate: "2026-08-02",
      status: "Em andamento",
      sourceTitle: SOURCES.crtsp.title,
      sourceUrl: SOURCES.crtsp.url,
      metadata: {
        focus: "Técnico Administrativo, com itens compatíveis para Fiscal quando o conteúdo coincidir.",
        style: "Certo/Errado, alta atenção a literalidade normativa e generalizações.",
        approval: "Prova objetiva eliminatória e classificatória; simulado interno modelado com 120 itens.",
        officialSource: "Quadrix — Conselho Regional dos Técnicos Industriais de São Paulo."
      }
    },
    {
      id: "contest-ibge",
      slug: "ibge",
      name: "IBGE",
      primaryRole: "Agente Censitário de Qualidade",
      board: "Instituto Avalia",
      examDate: "2026-08-30",
      status: "Edital publicado",
      sourceTitle: SOURCES.ibge02.title,
      sourceUrl: SOURCES.ibge02.url,
      metadata: {
        focus: "Agente Censitário de Qualidade e seção separada para Analista Censitário em TI, Desenvolvimento e Ciência de Dados.",
        style: "Múltipla escolha com 5 alternativas e apenas uma correta.",
        approval: "ACQ: mínimo de 30% do total e 1 questão por disciplina. Analista: mínimo de 40% do total e 1 questão por disciplina.",
        officialSource: "IBGE/Instituto Avalia — PSS nº 02/2026."
      }
    },
    {
      id: "contest-santos",
      slug: "prefeitura-santos",
      name: "Prefeitura de Santos",
      primaryRole: "Oficial de Administração",
      board: "IBAM",
      examDate: "2026-09-27",
      status: "Em andamento",
      sourceTitle: SOURCES.santos71.title,
      sourceUrl: SOURCES.santos71.url,
      metadata: {
        focus: "Oficial de Administração, ensino médio, rotinas administrativas e legislação municipal.",
        style: "Múltipla escolha, abordagem prática, texto administrativo e legislação local.",
        approval: "Prova objetiva e redação; redação com mínimo de 20 pontos no edital.",
        officialSource: "IBAM — Santos, Edital nº 71/2026 — SEPLA-RH."
      }
    }
  ],
  roles: [
    {
      id: "role-crtsp-tecnico-administrativo",
      contestId: "contest-crt-sp",
      slug: "tecnico-administrativo-baixada",
      name: "Técnico Administrativo — Baixada Santista",
      level: "Ensino médio",
      questionTarget: 100,
      examConfig: {
        questionType: "certo_errado",
        completeSimulationQuestions: 120,
        durationMinutes: 180,
        scoring: "+1 por acerto, -1 por erro, 0 em branco",
        blocks: [
          { name: "Conhecimentos básicos", target: 40 },
          { name: "Conhecimentos complementares", target: 30 },
          { name: "Conhecimentos específicos", target: 50 }
        ]
      }
    },
    {
      id: "role-ibge-acq",
      contestId: "contest-ibge",
      slug: "agente-censitario-qualidade",
      name: "Agente Censitário de Qualidade",
      level: "Ensino médio",
      questionTarget: 100,
      examConfig: {
        questionType: "multipla_escolha",
        completeSimulationQuestions: 60,
        durationMinutes: 240,
        scoring: "1 ponto por questão correta",
        approvalCriteria: "30% do total e pelo menos 1 acerto por disciplina",
        blocks: [
          { name: "Língua Portuguesa", target: 15 },
          { name: "Raciocínio Lógico Quantitativo", target: 10 },
          { name: "Geografia", target: 15 },
          { name: "Conhecimentos Técnicos", target: 20 }
        ]
      }
    },
    {
      id: "role-ibge-analista-ti",
      contestId: "contest-ibge",
      slug: "analista-censitario-ti-dados",
      name: "Analista Censitário — TI, Desenvolvimento e Ciência de Dados",
      level: "Ensino superior",
      questionTarget: 50,
      examConfig: {
        questionType: "multipla_escolha",
        completeSimulationQuestions: 60,
        durationMinutes: 240,
        scoring: "1 ponto por questão correta",
        approvalCriteria: "40% do total e pelo menos 1 acerto por disciplina",
        blocks: [
          { name: "Língua Portuguesa", target: 15 },
          { name: "Raciocínio Lógico Quantitativo", target: 10 },
          { name: "Conhecimentos Específicos", target: 35 }
        ]
      }
    },
    {
      id: "role-santos-oficial-administracao",
      contestId: "contest-santos",
      slug: "oficial-administracao",
      name: "Oficial de Administração",
      level: "Ensino médio",
      questionTarget: 100,
      examConfig: {
        questionType: "multipla_escolha",
        completeSimulationQuestions: 50,
        durationMinutes: 240,
        scoring: "1 ponto por questão objetiva correta; redação em avaliação separada",
        approvalCriteria: "Redação com nota mínima de 20 pontos, conforme edital.",
        blocks: [
          { name: "Português", target: 15 },
          { name: "Matemática", target: 10 },
          { name: "Legislação municipal e serviço público", target: 10 },
          { name: "Informática e rotinas administrativas", target: 15 }
        ]
      }
    }
  ]
};

const sharedMisconceptions = [
  "a regra permite ignorar formalidades quando houver pressa no atendimento",
  "toda informação pública pode ser divulgada sem análise de sigilo ou dados pessoais",
  "a eficiência autoriza afastar a legalidade quando o resultado for conveniente",
  "a ausência de registro formal não compromete a rastreabilidade do procedimento",
  "a banca considera corretas generalizações com sempre, nunca e apenas"
];

const subjectSpecs = [
  {
    id: "subj-crt-portugues",
    contestId: "contest-crt-sp",
    roleId: "role-crtsp-tecnico-administrativo",
    slug: "portugues",
    name: "Português",
    weight: 7,
    count: 12,
    source: SOURCES.crtsp,
    board: "Quadrix",
    questionType: "certo_errado",
    syllabus: ["interpretação de texto", "pontuação", "concordância", "coesão", "redação administrativa"],
    topics: [
      ["coesão referencial", "o emprego de pronomes e expressões retomadoras evita repetição e preserva a progressão textual em ofícios e memorandos", "A coesão amarra informações anteriores e posteriores sem comprometer clareza."],
      ["pontuação", "a vírgula não deve separar sujeito e predicado quando não houver termo intercalado", "Separar sujeito e verbo é erro clássico explorado em itens Certo/Errado."],
      ["concordância", "a concordância verbal deve considerar o núcleo do sujeito, mesmo em períodos administrativos longos", "A banca costuma esconder o núcleo entre adjuntos e apostos."],
      ["linguagem formal", "a redação administrativa deve priorizar clareza, impessoalidade e correção gramatical", "Documentos oficiais pedem padrão formal e objetivo."],
      ["reescrita", "a reescrita só é adequada quando preserva sentido original e correção gramatical", "Trocas pequenas podem alterar nexo lógico ou regência."]
    ],
    misconceptions: [
      "a linguagem administrativa deve usar expressões rebuscadas mesmo quando isso reduz clareza",
      "a vírgula pode separar sujeito e verbo sempre que o sujeito for extenso",
      "qualquer substituição lexical mantém o sentido original do texto",
      "a impessoalidade elimina a necessidade de precisão vocabular"
    ]
  },
  {
    id: "subj-crt-rlm",
    contestId: "contest-crt-sp",
    roleId: "role-crtsp-tecnico-administrativo",
    slug: "raciocinio-logico",
    name: "Raciocínio Lógico e Matemática",
    weight: 6,
    count: 8,
    source: SOURCES.crtsp,
    board: "Quadrix",
    questionType: "certo_errado",
    syllabus: ["proposições", "porcentagem", "proporcionalidade", "sequências", "análise de dados"],
    topics: [
      ["negação lógica", "a negação de 'todos os processos foram revisados' é 'algum processo não foi revisado'", "A negação de quantificadores é recorrente em provas da banca."],
      ["porcentagem", "um acréscimo de 20% seguido de desconto de 20% não retorna necessariamente ao valor inicial", "Percentuais sucessivos incidem sobre bases diferentes."],
      ["proporcionalidade", "em grandezas diretamente proporcionais, a razão entre as medidas permanece constante", "É o núcleo da regra de três direta."],
      ["média aritmética", "a média pode ser afetada por valores extremos e não substitui a análise do conjunto", "Interpretação de dados exige cuidado com outliers."]
    ],
    misconceptions: [
      "a negação de todos é nenhum",
      "percentuais sucessivos sempre se anulam quando possuem o mesmo valor",
      "toda sequência numérica cresce por soma constante",
      "média e mediana são sempre iguais"
    ]
  },
  {
    id: "subj-crt-informatica",
    contestId: "contest-crt-sp",
    roleId: "role-crtsp-tecnico-administrativo",
    slug: "informatica",
    name: "Informática",
    weight: 6,
    count: 10,
    source: SOURCES.crtsp,
    board: "Quadrix",
    questionType: "certo_errado",
    syllabus: ["Microsoft 365", "Google Workspace", "Windows", "redes", "segurança", "nuvem e IA"],
    topics: [
      ["backup", "cópias de segurança devem ser testadas periodicamente para confirmar possibilidade de restauração", "Backup sem teste pode dar falsa sensação de segurança."],
      ["phishing", "mensagens com links suspeitos e senso de urgência exigem verificação antes de qualquer clique", "Engenharia social é uma cobrança típica de segurança."],
      ["nuvem", "armazenamento em nuvem exige controle de acesso e atenção ao compartilhamento de documentos", "Nuvem não elimina responsabilidade do usuário."],
      ["planilhas", "fórmulas em planilhas podem usar referências relativas ou absolutas conforme a necessidade", "Referências alteram comportamento ao copiar fórmulas."],
      ["sistemas operacionais", "organização de pastas facilita localização, controle de versões e recuperação de arquivos", "Arquivos administrativos dependem de rastreabilidade."]
    ],
    misconceptions: [
      "modo anônimo impede rastreamento por qualquer sistema",
      "antivírus atualizado dispensa backup",
      "arquivos em nuvem podem ser compartilhados publicamente sem risco",
      "uma senha forte elimina a necessidade de autenticação em dois fatores"
    ]
  },
  {
    id: "subj-crt-complementares",
    contestId: "contest-crt-sp",
    roleId: "role-crtsp-tecnico-administrativo",
    slug: "legislacao-etica",
    name: "Ética, Administração Pública, LAI, LGPD e Processo Administrativo",
    weight: 10,
    count: 18,
    source: SOURCES.crtsp,
    board: "Quadrix",
    questionType: "certo_errado",
    syllabus: ["ética pública", "princípios administrativos", "Lei 8.429/1992", "Lei 9.784/1999", "LAI", "LGPD"],
    topics: [
      ["legalidade", "a Administração Pública só pode agir conforme autorização do ordenamento jurídico", "Legalidade administrativa é mais restritiva que a liberdade privada."],
      ["impessoalidade", "a atuação administrativa deve buscar finalidade pública, sem promoção pessoal ou favorecimento", "Impessoalidade se conecta à finalidade e igualdade."],
      ["LAI", "a publicidade é regra, mas informações pessoais e sigilos legais exigem tratamento adequado", "A LAI não elimina hipóteses legítimas de restrição."],
      ["LGPD", "o tratamento de dados pessoais deve observar finalidade, necessidade, segurança e transparência", "Princípios da LGPD orientam atos administrativos digitais."],
      ["processo administrativo", "a motivação permite controle dos fundamentos de fato e de direito do ato administrativo", "A Lei 9.784/1999 cobra motivação e transparência decisória."],
      ["improbidade", "a responsabilização por improbidade exige análise da conduta e dos elementos previstos em lei", "Itens absolutistas sobre improbidade tendem a ser armadilha."]
    ],
    misconceptions: [
      "todo dado público pode ser divulgado integralmente",
      "a moralidade permite substituir a legalidade",
      "ato administrativo não precisa de motivação quando for conveniente",
      "a LGPD impede qualquer tratamento de dados pela Administração"
    ]
  },
  {
    id: "subj-crt-administracao",
    contestId: "contest-crt-sp",
    roleId: "role-crtsp-tecnico-administrativo",
    slug: "administracao-geral-publica",
    name: "Administração Geral e Pública",
    weight: 9,
    count: 14,
    source: SOURCES.crtsp,
    board: "Quadrix",
    questionType: "certo_errado",
    syllabus: ["processo administrativo", "estrutura organizacional", "qualidade", "administração pública", "processos e projetos"],
    topics: [
      ["processo administrativo gerencial", "planejar, organizar, dirigir e controlar são funções administrativas interdependentes", "As funções não são etapas isoladas sem comunicação."],
      ["estrutura organizacional", "autoridade, responsabilidade e comunicação interna precisam estar coerentes com o modelo estrutural", "Estrutura define fluxos decisórios e operacionais."],
      ["qualidade", "melhoria contínua depende de medição, padronização e revisão dos processos", "Qualidade não é evento pontual."],
      ["descentralização", "descentralização transfere execução a outra pessoa jurídica; desconcentração distribui competências internamente", "A distinção é queridinha de bancas."],
      ["projetos", "projeto é esforço temporário orientado a resultado específico", "Processo é contínuo; projeto é temporário."]
    ],
    misconceptions: [
      "desconcentração cria uma nova pessoa jurídica",
      "controle só ocorre depois da execução",
      "projeto e processo são sinônimos",
      "eficiência autoriza descumprir procedimento legal"
    ]
  },
  {
    id: "subj-crt-rotinas",
    contestId: "contest-crt-sp",
    roleId: "role-crtsp-tecnico-administrativo",
    slug: "rotinas-protocolo-atendimento",
    name: "Rotinas administrativas, redação oficial, protocolo e atendimento",
    weight: 9,
    count: 16,
    source: SOURCES.crtsp,
    board: "Quadrix",
    questionType: "certo_errado",
    syllabus: ["protocolo", "arquivo", "redação oficial", "atendimento", "trabalho em equipe"],
    topics: [
      ["protocolo", "registro, classificação e distribuição de documentos favorecem rastreabilidade e controle de prazos", "Protocolo não é apenas recebimento físico."],
      ["redação oficial", "clareza, concisão, impessoalidade e formalidade orientam comunicações administrativas", "A banca cobra a finalidade prática da escrita oficial."],
      ["atendimento", "urbanidade e orientação adequada ao usuário não autorizam promessa de resultado fora da competência do órgão", "Atender bem não é criar direito indevido."],
      ["arquivo", "documentos devem observar organização, temporalidade e acesso conforme seu ciclo de vida", "Gestão documental envolve uso, guarda e destinação."],
      ["trabalho em equipe", "empatia e comunicação reduzem ruídos em fluxos administrativos", "Relações humanas aparecem em situações concretas."]
    ],
    misconceptions: [
      "protocolo é sinônimo de arquivamento definitivo",
      "linguagem simples permite informalidade excessiva",
      "atendente pode garantir deferimento para acalmar o usuário",
      "documento digital dispensa classificação e guarda"
    ]
  },
  {
    id: "subj-crt-materiais",
    contestId: "contest-crt-sp",
    roleId: "role-crtsp-tecnico-administrativo",
    slug: "materiais-logistica-licitacoes",
    name: "Materiais, estoques, logística e licitações",
    weight: 8,
    count: 10,
    source: SOURCES.crtsp,
    board: "Quadrix",
    questionType: "certo_errado",
    syllabus: ["suprimentos", "estoques", "armazenagem", "logística", "licitação pública"],
    topics: [
      ["PEPS", "o método PEPS prioriza a saída dos itens mais antigos, reduzindo risco de perdas e obsolescência", "É compatível com organização de almoxarifado."],
      ["estoque mínimo", "estoque mínimo ajuda a evitar interrupção do atendimento por falta de material", "O controle deve considerar consumo e prazo de reposição."],
      ["licitação", "dispensa e inexigibilidade são hipóteses distintas de contratação direta", "Não são termos intercambiáveis."],
      ["recebimento", "conferência de quantidade e especificação deve ocorrer antes do aceite definitivo quando aplicável", "Receber não é apenas armazenar."],
      ["logística", "lead time influencia ponto de pedido e planejamento de reposição", "Prazo de ressuprimento altera a gestão de estoque."]
    ],
    misconceptions: [
      "estoque máximo e mínimo possuem a mesma finalidade",
      "inexigibilidade ocorre sempre que a Administração preferir contratar diretamente",
      "material recebido não precisa de conferência se veio de fornecedor conhecido",
      "PEPS prioriza os itens recém-comprados"
    ]
  },
  {
    id: "subj-crt-sistema-cft",
    contestId: "contest-crt-sp",
    roleId: "role-crtsp-tecnico-administrativo",
    slug: "sistema-cft-crt",
    name: "Legislação do Sistema CFT/CRTs",
    weight: 10,
    count: 12,
    source: SOURCES.crtsp,
    board: "Quadrix",
    questionType: "certo_errado",
    syllabus: ["Lei 13.639/2018", "Lei 5.524/1968", "Decreto 90.922/1985", "Decreto 4.560/2002", "Regimento CRT-SP", "Resoluções CFT"],
    topics: [
      ["Lei 13.639/2018", "o Sistema CFT/CRTs possui função de orientação, disciplina e fiscalização do exercício profissional dos técnicos industriais", "A lei criou o CFT e os CRTs com competências próprias."],
      ["Lei 5.524/1968", "a legislação profissional do técnico industrial integra o núcleo específico cobrado para Técnico Administrativo e Fiscal", "Conteúdo compatível entre cargos deve ser reaproveitado na revisão."],
      ["Código de Ética", "infrações éticas exigem análise conforme normas do Sistema CFT/CRTs", "Não basta julgamento subjetivo sem base normativa."],
      ["Regimento CRT-SP", "normas internas estruturam competências, órgãos e fluxos decisórios do conselho regional", "Regimento costuma cair em detalhes organizacionais."],
      ["fiscalização", "ações fiscalizatórias podem ter caráter preventivo e educativo sem perder natureza de controle profissional", "Fiscalização moderna combina orientação e sanção quando cabível."]
    ],
    misconceptions: [
      "o CRT-SP atua apenas como entidade privada sem função fiscalizatória",
      "resolução pode contrariar lei federal",
      "código de ética não se relaciona com processo administrativo",
      "fiscalização educativa impede qualquer medida sancionatória"
    ]
  },
  {
    id: "subj-ibge-acq-portugues",
    contestId: "contest-ibge",
    roleId: "role-ibge-acq",
    slug: "portugues",
    name: "Língua Portuguesa",
    weight: 15,
    count: 20,
    source: SOURCES.ibge02,
    board: "Instituto Avalia",
    questionType: "multipla_escolha",
    syllabus: ["interpretação", "sinônimos e antônimos", "pontuação", "ortografia", "coesão", "redação operacional"],
    topics: [
      ["interpretação de comunicado operacional", "a alternativa que preserva a finalidade do texto e identifica corretamente seu público-alvo é a mais adequada", "A banca tende a cobrar leitura funcional do texto."],
      ["reescrita formal", "a reescrita deve manter sentido, clareza e correção gramatical", "Mudança de conectivo pode alterar causa, oposição ou conclusão."],
      ["pontuação", "a pontuação organiza relações sintáticas e semânticas do período", "Vírgula não é pausa aleatória."],
      ["coesão", "conectores e referenciação evitam ambiguidades em registros operacionais", "Comunicação de campo precisa ser precisa."]
    ],
    misconceptions: [
      "texto operacional pode sacrificar clareza desde que seja breve",
      "todo conector adversativo expressa conclusão",
      "reescrita não precisa manter o sentido original",
      "pontuação depende apenas da respiração do leitor"
    ]
  },
  {
    id: "subj-ibge-acq-rlq",
    contestId: "contest-ibge",
    roleId: "role-ibge-acq",
    slug: "raciocinio-logico-quantitativo",
    name: "Raciocínio Lógico Quantitativo",
    weight: 10,
    count: 15,
    source: SOURCES.ibge02,
    board: "Instituto Avalia",
    questionType: "multipla_escolha",
    syllabus: ["estruturas lógicas", "argumentação", "diagramas", "aritmética", "álgebra e geometria básicas"],
    topics: [
      ["diagramas lógicos", "diagramas ajudam a representar relações entre conjuntos e verificar conclusões válidas", "O edital cita diagramas lógicos expressamente."],
      ["aritmética", "porcentagens devem ser calculadas sobre a base indicada no problema", "Questões operacionais costumam mudar a base."],
      ["argumentação", "conclusão válida decorre das premissas, ainda que o conteúdo pareça improvável", "Validade lógica não é opinião sobre o mundo."],
      ["geometria básica", "perímetro e área medem grandezas diferentes e não podem ser comparados como equivalentes", "Unidade de medida denuncia erro conceitual."]
    ],
    misconceptions: [
      "premissa verdadeira garante conclusão válida em qualquer argumento",
      "porcentagens sempre se somam diretamente",
      "área e perímetro usam a mesma unidade",
      "diagrama lógico substitui a leitura das condições"
    ]
  },
  {
    id: "subj-ibge-acq-geografia",
    contestId: "contest-ibge",
    roleId: "role-ibge-acq",
    slug: "geografia",
    name: "Geografia",
    weight: 15,
    count: 25,
    source: SOURCES.ibge02,
    board: "Instituto Avalia",
    questionType: "multipla_escolha",
    syllabus: ["cartografia", "coordenadas", "escalas", "espaço agrário", "estrutura fundiária", "povos tradicionais"],
    topics: [
      ["coordenadas geográficas", "latitude e longitude permitem localizar pontos na superfície terrestre", "Cartografia básica é central para operações censitárias."],
      ["escala cartográfica", "escala relaciona distância no mapa e distância real", "Interpretação de escala evita erros de campo."],
      ["espaço agrário", "modernização tecnológica pode aumentar produtividade e também produzir impactos socioespaciais", "O edital une economia agrária e conflitos."],
      ["estrutura fundiária", "a estrutura fundiária trata da distribuição e concentração da terra", "Tema clássico de geografia agrária."],
      ["povos tradicionais", "povos e comunidades tradicionais exigem leitura territorial e sociocultural adequada", "A abordagem censitária precisa respeitar diversidade."]
    ],
    misconceptions: [
      "latitude mede distância em relação ao meridiano de Greenwich",
      "escala maior sempre mostra menor detalhe",
      "modernização agrícola elimina conflitos no campo",
      "estrutura fundiária se limita ao tipo de cultivo"
    ]
  },
  {
    id: "subj-ibge-acq-tecnicos",
    contestId: "contest-ibge",
    roleId: "role-ibge-acq",
    slug: "conhecimentos-tecnicos-censo-agro",
    name: "Conhecimentos Técnicos do Censo Agropecuário",
    weight: 20,
    count: 40,
    source: SOURCES.ibge02,
    board: "Instituto Avalia",
    questionType: "multipla_escolha",
    syllabus: ["coleta censitária", "qualidade da informação", "produtividade", "cumprimento de prazos", "setor censitário", "treinamento"],
    topics: [
      ["qualidade da coleta", "a conferência de consistência e completude reduz falhas antes da consolidação dos dados", "ACQ atua com foco em qualidade e produtividade."],
      ["setor censitário", "setor censitário delimita área de trabalho e orienta a organização da coleta", "O conceito aparece nos editais do Censo Agro."],
      ["treinamento", "avaliações de aprendizagem podem ocorrer durante ou ao final do treinamento", "O edital prevê treinamento híbrido e avaliação."],
      ["produtividade", "cumprimento de prazos e produtividade são fatores associados à avaliação do ACQ", "A função tem metas operacionais."],
      ["dados censitários", "registro padronizado e conferência de dados sustentam comparabilidade estatística", "Qualidade depende de padronização e rastreabilidade."]
    ],
    misconceptions: [
      "qualidade censitária é avaliada apenas ao final do processo",
      "setor censitário pode ser redefinido livremente pelo agente sem orientação",
      "treinamento não possui efeito contratual",
      "produtividade dispensa consistência das informações"
    ]
  },
  {
    id: "subj-ibge-ti-portugues",
    contestId: "contest-ibge",
    roleId: "role-ibge-analista-ti",
    slug: "portugues",
    name: "Língua Portuguesa",
    weight: 15,
    count: 8,
    source: SOURCES.ibge02,
    board: "Instituto Avalia",
    questionType: "multipla_escolha",
    syllabus: ["interpretação", "coesão", "reescrita", "comunicação técnica"],
    topics: [
      ["documentação técnica", "a comunicação técnica deve ser precisa, objetiva e coerente com o público destinatário", "Analistas precisam documentar decisões e resultados."],
      ["coesão", "a relação entre pronomes, conectores e referentes evita ambiguidade", "Ambiguidade prejudica especificações e comunicados."],
      ["reescrita", "reescrever preservando sentido exige manter relações lógicas do período", "A troca de conectivo é armadilha recorrente."]
    ],
    misconceptions: [
      "texto técnico dispensa norma-padrão",
      "ambiguidade é aceitável quando o leitor conhece o sistema",
      "conectores podem ser trocados sem impacto semântico"
    ]
  },
  {
    id: "subj-ibge-ti-rlq",
    contestId: "contest-ibge",
    roleId: "role-ibge-analista-ti",
    slug: "raciocinio-logico-quantitativo",
    name: "Raciocínio Lógico Quantitativo",
    weight: 10,
    count: 7,
    source: SOURCES.ibge02,
    board: "Instituto Avalia",
    questionType: "multipla_escolha",
    syllabus: ["estruturas lógicas", "argumentação", "aritmética", "álgebra", "geometria"],
    topics: [
      ["lógica de predicados", "quantificadores exigem atenção a negações e implicações", "TI e dados exigem precisão lógica."],
      ["proporções", "razões e proporções sustentam análises quantitativas simples", "Base comum para leitura de indicadores."],
      ["argumentação", "validade independe da veracidade empírica isolada das proposições", "É cobrança clássica de lógica formal."]
    ],
    misconceptions: [
      "a recíproca de uma implicação é sempre equivalente",
      "todo aumento percentual usa a mesma base",
      "conclusão plausível é sinônimo de conclusão válida"
    ]
  },
  {
    id: "subj-ibge-ti-ciencia-dados",
    contestId: "contest-ibge",
    roleId: "role-ibge-analista-ti",
    slug: "ciencia-de-dados",
    name: "Ciência de Dados",
    weight: 12,
    count: 12,
    source: SOURCES.ibge02,
    board: "Instituto Avalia",
    questionType: "multipla_escolha",
    syllabus: ["modelagem de dados", "estatística aplicada", "ETL", "qualidade de dados", "visualização", "LGPD"],
    topics: [
      ["qualidade de dados", "completude, consistência e validade são dimensões relevantes para avaliar bases estatísticas", "Censo depende de dados confiáveis."],
      ["ETL", "processos de extração, transformação e carga organizam dados para análise e uso operacional", "ETL é base de pipelines."],
      ["visualização", "gráficos devem representar dados com escala adequada e sem distorção", "Visualização também comunica risco de interpretação."],
      ["LGPD em dados", "dados pessoais exigem finalidade, segurança e controle de acesso", "Tratamento estatístico precisa respeitar proteção de dados."]
    ],
    misconceptions: [
      "volume de dados garante qualidade",
      "ETL é apenas cópia de arquivos",
      "visualização não influencia interpretação",
      "anonimização e pseudonimização são sempre equivalentes"
    ]
  },
  {
    id: "subj-ibge-ti-desenvolvimento",
    contestId: "contest-ibge",
    roleId: "role-ibge-analista-ti",
    slug: "desenvolvimento-sistemas",
    name: "Desenvolvimento de Sistemas",
    weight: 13,
    count: 13,
    source: SOURCES.ibge02,
    board: "Instituto Avalia",
    questionType: "multipla_escolha",
    syllabus: ["algoritmos", "estruturas de dados", "programação", "APIs", "segurança", "OWASP Top 10"],
    topics: [
      ["estruturas de dados", "pilhas seguem a lógica LIFO e filas seguem a lógica FIFO", "Conceitos básicos aparecem no edital."],
      ["algoritmos de ordenação", "complexidade ajuda a comparar desempenho de algoritmos em diferentes volumes de entrada", "Não basta saber o nome do algoritmo."],
      ["APIs", "controle de acesso em APIs deve validar autenticação, autorização e escopo de dados", "O edital menciona segurança em APIs."],
      ["OWASP Top 10", "vulnerabilidades como injeção e falhas de controle de acesso exigem mitigação no desenho da aplicação", "Segurança é parte do desenvolvimento."],
      ["testes", "testes automatizados reduzem regressões e documentam comportamento esperado", "Desenvolvimento confiável envolve validação contínua."]
    ],
    misconceptions: [
      "fila e pilha possuem a mesma política de remoção",
      "complexidade só importa em linguagens compiladas",
      "autenticação substitui autorização",
      "testes automatizados eliminam revisão de código"
    ]
  },
  {
    id: "subj-ibge-ti-infra",
    contestId: "contest-ibge",
    roleId: "role-ibge-analista-ti",
    slug: "infraestrutura-suporte-ti",
    name: "Infraestrutura e Suporte de TI",
    weight: 10,
    count: 10,
    source: SOURCES.ibge02,
    board: "Instituto Avalia",
    questionType: "multipla_escolha",
    syllabus: ["redes", "sistemas operacionais", "suporte", "segurança", "serviços corporativos"],
    topics: [
      ["redes", "endereçamento, conectividade e serviços de rede devem ser analisados de forma coordenada no suporte", "Suporte exige visão por camadas."],
      ["sistemas operacionais", "logs e eventos auxiliam diagnóstico de falhas em estações e servidores", "Observabilidade básica reduz tentativa e erro."],
      ["segurança", "privilégio mínimo reduz impacto de credenciais comprometidas", "Controle de acesso é princípio básico."],
      ["suporte", "registro de chamados cria histórico, métricas e rastreabilidade do atendimento", "Rotina de suporte também é gestão de informação."]
    ],
    misconceptions: [
      "ping bem-sucedido garante funcionamento de todos os serviços",
      "usuário administrador local é prática recomendada para todos",
      "logs devem ser apagados após resolver incidentes",
      "chamados repetidos não precisam de categorização"
    ]
  },
  {
    id: "subj-santos-portugues",
    contestId: "contest-santos",
    roleId: "role-santos-oficial-administracao",
    slug: "portugues-redacao-administrativa",
    name: "Português e comunicação administrativa",
    weight: 15,
    count: 20,
    source: SOURCES.santos71,
    board: "IBAM",
    questionType: "multipla_escolha",
    syllabus: ["interpretação", "ortografia", "concordância", "crase", "reescrita", "linguagem formal"],
    topics: [
      ["clareza administrativa", "comunicações administrativas devem ser claras, objetivas, impessoais e gramaticalmente corretas", "O edital destaca comunicação administrativa."],
      ["concordância", "o verbo concorda com o núcleo do sujeito, salvo construções específicas previstas na norma", "Questões do IBAM costumam cobrar norma-padrão."],
      ["crase", "o uso de crase depende da fusão entre preposição e artigo ou pronome compatível", "Não basta decorar antes de palavra feminina."],
      ["reescrita", "a reescrita correta mantém sentido e adequação ao padrão formal", "Mudanças de ordem podem alterar ênfase e clareza."]
    ],
    misconceptions: [
      "clareza permite abreviações informais em documento oficial",
      "crase ocorre antes de qualquer palavra feminina",
      "concordância pode seguir o termo mais próximo em todos os casos",
      "reescrita pode alterar sentido se melhorar o estilo"
    ]
  },
  {
    id: "subj-santos-matematica",
    contestId: "contest-santos",
    roleId: "role-santos-oficial-administracao",
    slug: "matematica",
    name: "Matemática",
    weight: 10,
    count: 15,
    source: SOURCES.santos71,
    board: "IBAM",
    questionType: "multipla_escolha",
    syllabus: ["operações fundamentais", "frações", "porcentagem", "razão e proporção", "medidas", "gráficos"],
    topics: [
      ["porcentagem", "acréscimos e descontos simples devem usar a base indicada no enunciado", "Situações administrativas envolvem orçamento e materiais."],
      ["regra de três", "grandezas proporcionais exigem identificar se a relação é direta ou inversa", "O erro comum é montar proporção sem analisar o contexto."],
      ["medidas", "conversões de unidades devem respeitar fator correto entre grandezas", "Medidas aparecem em rotinas de materiais."],
      ["gráficos", "leitura de tabelas e gráficos depende de título, escala e unidade", "IBAM cobra interpretação objetiva."]
    ],
    misconceptions: [
      "todo problema com três valores usa regra de três direta",
      "percentual de desconto sempre incide sobre o valor final",
      "metros quadrados e metros lineares são equivalentes",
      "gráfico dispensa leitura da escala"
    ]
  },
  {
    id: "subj-santos-legislacao",
    contestId: "contest-santos",
    roleId: "role-santos-oficial-administracao",
    slug: "legislacao-municipal-servico-publico",
    name: "Legislação municipal e serviço público",
    weight: 14,
    count: 25,
    source: SOURCES.santos71,
    board: "IBAM",
    questionType: "multipla_escolha",
    syllabus: ["Lei Orgânica", "Estatuto dos Funcionários", "LC 1.253/2024", "Lei 13.460/2017", "LAI", "LGPD", "governo digital"],
    topics: [
      ["Lei Orgânica", "competências municipais e princípios da Administração orientam a atuação dos órgãos locais", "O edital cobra organização municipal."],
      ["Estatuto dos Funcionários", "deveres como assiduidade, pontualidade, urbanidade e zelo integram a conduta funcional", "A rotina do cargo depende desses deveres."],
      ["serviço público ao usuário", "atendimento adequado exige urbanidade, acessibilidade e informação clara ao cidadão", "Lei 13.460/2017 aparece no edital."],
      ["LAI e LGPD", "transparência e proteção de dados devem ser compatibilizadas no atendimento público", "Publicidade não elimina proteção de informações pessoais."],
      ["governo digital", "meios eletrônicos devem ampliar acesso e eficiência sem afastar segurança e interoperabilidade", "Lei 14.129/2021 compõe o programa."]
    ],
    misconceptions: [
      "sigilo funcional autoriza negar toda informação ao usuário",
      "pontualidade é apenas recomendação sem relevância disciplinar",
      "governo digital elimina atendimento presencial em qualquer situação",
      "LGPD impede transparência ativa"
    ]
  },
  {
    id: "subj-santos-informatica-rotinas",
    contestId: "contest-santos",
    roleId: "role-santos-oficial-administracao",
    slug: "informatica-rotinas-administrativas",
    name: "Informática e rotinas administrativas",
    weight: 13,
    count: 25,
    source: SOURCES.santos71,
    board: "IBAM",
    questionType: "multipla_escolha",
    syllabus: ["Windows", "editores de texto", "planilhas", "internet", "segurança", "protocolo", "arquivo", "atendimento"],
    topics: [
      ["protocolo", "autuação, juntada, tramitação e distribuição apoiam controle de documentos e processos", "O edital lista rotinas de protocolo."],
      ["planilhas", "fórmulas básicas como soma, média, mínimo e máximo apoiam controles administrativos", "Planilhas entram em rotina de cadastros e relatórios."],
      ["e-mail", "anexos, links e mensagens suspeitas exigem cuidado para reduzir risco de phishing", "Segurança digital está no programa."],
      ["arquivo", "classificação e conservação de documentos sustentam gestão documental física e eletrônica", "Arquivo não é depósito sem critério."],
      ["atendimento", "registro e encaminhamento de solicitações permitem acompanhar prazos e responsabilidades", "Atendimento administrativo precisa de rastreabilidade."]
    ],
    misconceptions: [
      "arquivo digital dispensa organização por assunto ou temporalidade",
      "planilhas não precisam de conferência após filtro ou classificação",
      "qualquer link recebido de órgão público é seguro",
      "atendimento telefônico não precisa de registro"
    ]
  },
  {
    id: "subj-santos-licitacoes-materiais",
    contestId: "contest-santos",
    roleId: "role-santos-oficial-administracao",
    slug: "compras-materiais-contratos",
    name: "Compras públicas, materiais e contratos",
    weight: 9,
    count: 15,
    source: SOURCES.santos71,
    board: "IBAM",
    questionType: "multipla_escolha",
    syllabus: ["Lei 14.133/2021 aplicada", "requisição", "recebimento", "almoxarifado", "patrimônio", "contratos"],
    topics: [
      ["requisição de materiais", "requisição deve identificar necessidade, quantidade e especificação para apoiar a compra pública", "Apoio administrativo exige documentação precisa."],
      ["recebimento", "conferir nota, quantidade e especificação reduz risco de aceite indevido", "Recebimento é etapa de controle."],
      ["contratos", "prazos, vigências e documentos contratuais devem ser acompanhados administrativamente", "O edital cobra apoio à execução contratual."],
      ["patrimônio", "uso, guarda, conservação e controle de bens públicos exigem zelo do servidor", "Zelo patrimonial conecta rotina e dever funcional."],
      ["Lei 14.133/2021", "rotinas de contratação devem observar planejamento, formalização e controle", "Mesmo noções básicas aparecem aplicadas à rotina."]
    ],
    misconceptions: [
      "compra pública pode ser feita verbalmente se o valor for pequeno",
      "recebimento definitivo dispensa conferência documental",
      "bens de uso comum não precisam de controle patrimonial",
      "vigência contratual só interessa ao setor jurídico"
    ]
  }
];

function pad(number) {
  return String(number).padStart(3, "0");
}

function pick(list, index) {
  return list[index % list.length];
}

function makeAlternatives(subject, correctText, index) {
  const correctLetter = LETTERS[index % LETTERS.length];
  const wrongPool = [...subject.misconceptions, ...sharedMisconceptions];
  let wrongIndex = 0;
  return {
    correctAnswer: correctLetter,
    alternatives: LETTERS.map((letter) => {
      if (letter === correctLetter) {
        return { key: letter, text: correctText };
      }
      const text = pick(wrongPool, index + wrongIndex);
      wrongIndex += 1;
      return {
        key: letter,
        text: text.charAt(0).toUpperCase() + text.slice(1) + "."
      };
    })
  };
}

function makeQuestion(subject, index) {
  const [topic, correctFact, explanation] = pick(subject.topics, index);
  const common = {
    id: `${subject.id.replace("subj-", "q-")}-${pad(index + 1)}`,
    contestId: subject.contestId,
    roleId: subject.roleId,
    subjectId: subject.id,
    cargo: studyContestSeed.roles.find((role) => role.id === subject.roleId)?.name || "",
    matter: subject.name,
    topic,
    explanation: `${explanation} Questão inédita criada a partir do conteúdo programático oficial e do estilo da banca ${subject.board}.`,
    difficulty: pick(["facil", "medio", "dificil"], index),
    board: subject.board,
    referenceYear: subject.source.referenceYear,
    source: subject.source.title,
    sourceUrl: subject.source.url,
    originType: "inedita"
  };

  if (subject.questionType === "certo_errado") {
    const isCorrect = index % 2 === 0;
    const statementCore = isCorrect ? correctFact : pick(subject.misconceptions, index);
    return {
      ...common,
      statement: `No contexto de ${common.cargo}, julgue o item sobre ${topic}: ${statementCore}.`,
      alternatives: [
        { key: "C", text: "Certo" },
        { key: "E", text: "Errado" }
      ],
      correctAnswer: isCorrect ? "C" : "E"
    };
  }

  const correctText = correctFact.charAt(0).toUpperCase() + correctFact.slice(1) + ".";
  const { alternatives, correctAnswer } = makeAlternatives(subject, correctText, index);
  return {
    ...common,
    statement: `Considerando ${subject.name} para ${common.cargo}, assinale a alternativa correta sobre ${topic}.`,
    alternatives,
    correctAnswer
  };
}

export function getStudySubjects() {
  return subjectSpecs.map((subject, index) => ({
    id: subject.id,
    contestId: subject.contestId,
    roleId: subject.roleId,
    slug: subject.slug,
    name: subject.name,
    weight: subject.weight,
    sortOrder: index + 1,
    syllabus: subject.syllabus
  }));
}

export function getStudyQuestions() {
  return subjectSpecs.flatMap((subject) => (
    Array.from({ length: subject.count }, (_, index) => makeQuestion(subject, index))
  ));
}

export function getStudySeedSummary() {
  const questions = getStudyQuestions();
  return studyContestSeed.contests.map((contest) => ({
    contestId: contest.id,
    name: contest.name,
    questions: questions.filter((question) => question.contestId === contest.id).length
  }));
}
