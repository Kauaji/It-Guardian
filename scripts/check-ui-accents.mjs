#!/usr/bin/env node
// Falha se aparecerem termos de uma lista curada SEM acento em textos visiveis da interface
// (JSX, aria-label/title/placeholder, mensagens de erro/aviso, rotulos) de client/src.
//
// Politica (docs/FRONTEND-DESIGN-SYSTEM.md, "Acessibilidade e idioma"): todo texto visivel ao
// usuario e escrito em portugues correto, com acentos. Identificadores, chaves de objeto,
// classes CSS, rotas/URLs e valores de dados/enums (enviados a API ou comparados) continuam sem
// acento, e por isso o verificador so olha:
//   - texto JSX (entre tags) e linhas de texto puro dentro de JSX;
//   - literais de string/template que parecem frase (tem espaco) ou rotulo capitalizado;
// e ignora literais "tecnicos" (a-z0-9_-./:#), URLs, fusos (America/Sao_Paulo), comentarios e
// literais comparados (=== / !== / includes( / case) por serem chaves de dados normalizadas.
// Para liberar um caso legitimo, adicione `accents-ok` num comentario da mesma linha.
//
// Uso: node scripts/check-ui-accents.mjs
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const srcDir = path.join(root, "client", "src");

// termo sem acento -> forma correta. Lista curada: so entram palavras que NAO existem sem acento em
// portugues (ou cujo uso sem acento em texto de interface e sempre erro).
const TERMS = Object.fromEntries(
  `nao=não sao=são codigo=código codigos=códigos descricao=descrição configuracao=configuração configuracoes=configurações
informacao=informação informacoes=informações sessao=sessão sessoes=sessões servico=serviço servicos=serviços inventario=inventário
pagina=página usuario=usuário usuarios=usuários atencao=atenção permissao=permissão permissoes=permissões manutencao=manutenção
peca=peça pecas=peças visualizacao=visualização visualizacoes=visualizações autenticacao=autenticação seguranca=segurança
historico=histórico observacao=observação observacoes=observações relatorio=relatório relatorios=relatórios estatistica=estatística
estatisticas=estatísticas critico=crítico criticos=críticos critica=crítica criticas=críticas necessario=necessário necessaria=necessária
obrigatorio=obrigatório obrigatoria=obrigatória voce=você ate=até tambem=também ja=já so=só ha=há la=lá area=área areas=áreas
producao=produção aplicacao=aplicação notificacao=notificação notificacoes=notificações associacao=associação conexao=conexão
conexoes=conexões execucao=execução execucoes=execuções validacao=validação periodo=período proximo=próximo proxima=próxima
proximas=próximas proximos=próximos ultimo=último ultima=última ultimos=últimos ultimas=últimas numero=número endereco=endereço
versao=versão versoes=versões possivel=possível impossivel=impossível disponivel=disponível disponiveis=disponíveis
indisponivel=indisponível indisponiveis=indisponíveis invalido=inválido invalida=inválida invalidos=inválidos maquina=máquina
maquinas=máquinas tecnico=técnico tecnica=técnica tecnicos=técnicos tecnicas=técnicas titulo=título periferico=periférico
perifericos=periféricos patrimonio=patrimônio localizacao=localização selecao=seleção acao=ação acoes=ações alteracao=alteração
alteracoes=alterações opcao=opção opcoes=opções funcao=função importacao=importação exportacao=exportação integracao=integração
integracoes=integrações identificacao=identificação organizacao=organização solucao=solução solicitacao=solicitação revisao=revisão
resolucao=resolução responsavel=responsável saude=saúde padrao=padrão catalogo=catálogo grafico=gráfico graficos=gráficos
metrica=métrica metricas=métricas tendencia=tendência tendencias=tendências simulacao=simulação posicao=posição previa=prévia
preferencias=preferências variaveis=variáveis temporaria=temporária unica=única provavel=provável excluido=excluído
cabecalho=cabeçalho espaco=espaço reuniao=reunião escritorio=escritório recepcao=recepção medico=médico comodo=cômodo
comodos=cômodos distancia=distância divisoria=divisória rotulo=rótulo rotacao=rotação extensao=extensão tensao=tensão
eletrica=elétrica eletrico=elétrico estacao=estação direcao=direção edicao=edição exibicao=exibição navegacao=navegação
distribuicao=distribuição correlacao=correlação comunicacao=comunicação demarcacao=demarcação impressao=impressão
logica=lógica fisica=física minimo=mínimo moveis=móveis pinceis=pincéis terreo=térreo video=vídeo vinculo=vínculo
vinculos=vínculos camera=câmera cameras=câmeras copia=cópia media=média inicio=início`
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => pair.split("="))
);

// Palavras que em portugues tambem existem sem acento (ou cuja grafia sem acento e comum fora de frases):
// so contam quando o literal tem espaco (e uma frase de interface).
const PHRASE_ONLY = new Set(["ate", "ja", "so", "ha", "la", "sao", "media", "copia", "video", "camera", "peca", "area", "inicio"]);

const COMPARISON_BEFORE = /(===|!==|==|!=|\bcase|\bincludes\(|\bstartsWith\(|\bendsWith\(|\bindexOf\(|\bhas\(|\bget\(|\bset\()\s*$/;
const COMPARISON_AFTER = /^\s*(===|!==|==|!=)/;
const STRING_RE = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
// Texto JSX: entre tags (`>texto<`) ou colado a expressoes (`{valor} texto<`, `>texto {valor}`).
const JSX_TEXT_RE = /(?<=[>}])([^<>{}\n]+)(?=[<{])/g;
const WORD_RE = /(?<![A-Za-zÀ-ÿ0-9_\-./$#])([A-Za-zÀ-ÿ]+)(?![A-Za-zÀ-ÿ0-9_])/g;

function looksTechnical(text) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^[a-z0-9_\-./:#[\]=*@]+$/.test(trimmed)) return true;
  return /America\/|https?:\/\/|^\/|\.(js|jsx|css|json|png|svg)\b/.test(trimmed);
}

function wordsWithoutAccent(text, isPhrase) {
  const found = [];
  for (const match of text.matchAll(WORD_RE)) {
    const word = match[1];
    if (word.length > 1 && word === word.toUpperCase()) continue; // siglas (SO, RH, OS)
    const lower = word.toLowerCase();
    if (!(lower in TERMS) || /[À-ÿ]/.test(word)) continue;
    if (PHRASE_ONLY.has(lower) && !isPhrase) continue;
    const next = text[match.index + word.length];
    const previous = match.index > 0 ? text[match.index - 1] : "";
    if (["-", "_", "/"].includes(next) || ["-", "_", "/", ".", "#"].includes(previous)) continue;
    found.push({ word, fix: TERMS[lower] });
  }
  return found;
}

function templateTextParts(body) {
  const parts = [];
  let index = 0;
  let buffer = "";
  while (index < body.length) {
    if (body.startsWith("${", index)) {
      let depth = 1;
      let end = index + 2;
      while (end < body.length && depth > 0) {
        if (body[end] === "{") depth += 1;
        else if (body[end] === "}") depth -= 1;
        end += 1;
      }
      parts.push({ text: buffer, code: false });
      buffer = "";
      parts.push({ text: body.slice(index, end), code: true });
      index = end;
    } else {
      buffer += body[index];
      index += 1;
    }
  }
  parts.push({ text: buffer, code: false });
  return parts;
}

// Retorna [{ line, word, fix, text }] para o conteudo de um arquivo-fonte.
export function findAccentIssues(source) {
  const issues = [];
  source.split("\n").forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (/^(\/\/|\*|\/\*|import )/.test(trimmed) || /accents-ok/.test(line)) return;
    const report = (text, isPhrase) => {
      for (const hit of wordsWithoutAccent(text, isPhrase)) issues.push({ line: lineIndex + 1, ...hit, text: text.trim().slice(0, 80) });
    };
    const scanString = (body, quote, matchIndex, matchLength) => {
      if (COMPARISON_BEFORE.test(line.slice(0, matchIndex)) || COMPARISON_AFTER.test(line.slice(matchIndex + matchLength))) return;
      if (looksTechnical(body)) return;
      const isPhrase = body.trim().includes(" ");
      if (quote !== "`") return report(body, isPhrase);
      for (const part of templateTextParts(body)) {
        if (!part.code) report(part.text, isPhrase);
        else
          for (const inner of part.text.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g)) {
            const text = inner[1] ?? inner[2] ?? "";
            if (!looksTechnical(text)) report(text, text.trim().includes(" "));
          }
      }
    };
    let matchedString = false;
    for (const match of line.matchAll(STRING_RE)) {
      matchedString = true;
      const body = match[1] ?? match[2] ?? match[3] ?? "";
      scanString(body, match[0][0], match.index, match[0].length);
    }
    let matchedJsx = false;
    for (const match of line.matchAll(JSX_TEXT_RE)) {
      matchedJsx = true;
      if (/[=;]|=>/.test(match[1]) || !/[A-Za-zÀ-ÿ]{2}/.test(match[1])) continue; // codigo, nao texto
      report(match[1], match[1].trim().includes(" "));
    }
    // Linha de texto puro dentro de JSX (varias linhas): so palavras e pontuacao simples.
    if (
      !matchedString &&
      !matchedJsx &&
      /^[A-Za-zÀ-ÿ0-9 ,.:!?'-]+$/.test(trimmed) &&
      trimmed.split(" ").length > 1 &&
      !/[a-z][.][A-Za-z]/.test(trimmed) &&
      !/^(return|const|let|if|else|for|case|default|export|function|await|throw|import)\b/.test(trimmed)
    ) {
      report(trimmed, true);
    }
  });
  return issues;
}

function listSourceFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "__fixtures__", "test", "__tests__"].includes(entry.name)) continue;
      listSourceFiles(full, files);
    } else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\.(js|jsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function main() {
  const failures = [];
  const files = listSourceFiles(srcDir);
  for (const file of files) {
    for (const issue of findAccentIssues(fs.readFileSync(file, "utf8"))) {
      failures.push(`${path.relative(root, file)}:${issue.line}  "${issue.word}" -> "${issue.fix}"  (${issue.text})`);
    }
  }
  if (failures.length > 0) {
    console.error(`check-ui-accents: ${failures.length} texto(s) de interface sem acento:`);
    for (const failure of failures) console.error(` - ${failure}`);
    console.error(
      "\nCorrija a ortografia (identificadores, rotas e valores de dados nao mudam). Casos legitimos: comentario `accents-ok` na linha."
    );
    process.exit(1);
  }
  console.log(`check-ui-accents: OK. ${files.length} arquivos de client/src verificados, ${Object.keys(TERMS).length} termos na lista.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
