import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ClipboardList, Filter, RotateCcw, Star, Trophy } from "lucide-react";
import {
  answerStudyQuestion,
  createStudyAttempt,
  favoriteStudyQuestion,
  fetchStudyContestOverview,
  fetchStudyContests,
  fetchStudyQuestions,
  fetchStudySimulation,
  fetchStudyWrongQuestions
} from "../../api.js";

const emptyFilters = {
  subjectId: "",
  dificuldade: "",
  status: "",
  favoritas: "",
  origem: "",
  assunto: ""
};

function formatDate(value) {
  if (!value) return "A confirmar";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function difficultyLabel(value) {
  return {
    facil: "Fácil",
    medio: "Médio",
    dificil: "Difícil"
  }[value] || value;
}

function answerStatus(question) {
  if (!question.selectedAnswer) return "Não respondida";
  return question.isCorrect ? "Correta" : "Errada";
}

function answerClass(question) {
  if (!question.selectedAnswer) return "";
  return question.isCorrect ? " correct" : " wrong";
}

function getRoleSubjects(subjects, roleId) {
  return subjects.filter((subject) => subject.roleId === roleId);
}

function getRoleQuestionType(role) {
  return role?.examConfig?.questionType || "multipla_escolha";
}

export default function StudyContestModule({ token, user, notify }) {
  const [contests, setContests] = useState([]);
  const [selectedContestId, setSelectedContestId] = useState(() => (
    localStorage.getItem(`it_guardian_study_contest_${user?.id || "anon"}`) || ""
  ));
  const [overview, setOverview] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [mode, setMode] = useState("materias");
  const [filters, setFilters] = useState(emptyFilters);
  const [questions, setQuestions] = useState([]);
  const [simulation, setSimulation] = useState(null);
  const [simulationAnswers, setSimulationAnswers] = useState({});
  const [simulationResult, setSimulationResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === selectedContestId),
    [contests, selectedContestId]
  );
  const roles = overview?.roles || [];
  const subjects = overview?.subjects || [];
  const selectedRole = roles.find((role) => role.id === selectedRoleId) || roles[0];
  const roleSubjects = getRoleSubjects(subjects, selectedRole?.id || "");
  const activeQuestionType = getRoleQuestionType(selectedRole);

  useEffect(() => {
    let cancelled = false;
    async function loadContests() {
      setLoading(true);
      try {
        const response = await fetchStudyContests(token);
        if (cancelled) return;
        const nextContests = response.contests || [];
        setContests(nextContests);
        setSelectedContestId((current) => current || nextContests[0]?.id || "");
      } catch (error) {
        if (!cancelled) notify(error.message, "danger");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadContests();
    return () => {
      cancelled = true;
    };
  }, [notify, token]);

  useEffect(() => {
    if (!selectedContestId) return;
    localStorage.setItem(`it_guardian_study_contest_${user?.id || "anon"}`, selectedContestId);
    let cancelled = false;
    async function loadOverview() {
      setQuestions([]);
      setOverview(null);
      setSelectedRoleId("");
      setSimulation(null);
      setSimulationResult(null);
      setQuestionsLoading(true);
      try {
        const response = await fetchStudyContestOverview(token, selectedContestId);
        if (cancelled) return;
        setOverview(response);
        const storedRole = localStorage.getItem(`it_guardian_study_role_${user?.id || "anon"}_${selectedContestId}`);
        const roleExists = response.roles?.some((role) => role.id === storedRole);
        setSelectedRoleId(roleExists ? storedRole : response.roles?.[0]?.id || "");
      } catch (error) {
        if (!cancelled) notify(error.message, "danger");
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    }
    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [notify, selectedContestId, token, user?.id]);

  useEffect(() => {
    if (!selectedContestId || !selectedRoleId) return;
    localStorage.setItem(`it_guardian_study_role_${user?.id || "anon"}_${selectedContestId}`, selectedRoleId);
  }, [selectedContestId, selectedRoleId, user?.id]);

  useEffect(() => {
    if (!selectedContestId || !selectedRoleId || mode === "simulado") return;
    if (overview?.contest?.id !== selectedContestId) return;
    if (!overview.roles?.some((role) => role.id === selectedRoleId)) return;
    let cancelled = false;
    async function loadQuestions() {
      setQuestionsLoading(true);
      try {
        const request = {
          roleId: selectedRoleId,
          subjectId: filters.subjectId,
          dificuldade: filters.dificuldade,
          status: filters.status,
          favoritas: filters.favoritas,
          origem: filters.origem,
          assunto: filters.assunto,
          limit: 80
        };
        const response = mode === "erradas"
          ? await fetchStudyWrongQuestions(token, selectedContestId, request)
          : await fetchStudyQuestions(token, selectedContestId, request);
        if (!cancelled) setQuestions(response.questions || []);
      } catch (error) {
        if (!cancelled) notify(error.message, "danger");
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    }
    loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [filters, mode, notify, overview, selectedContestId, selectedRoleId, token]);

  function selectContest(contestId) {
    setSelectedContestId(contestId);
    setSelectedRoleId("");
    setOverview(null);
    setMode("materias");
    setFilters(emptyFilters);
  }

  function selectRole(roleId) {
    setSelectedRoleId(roleId);
    setFilters(emptyFilters);
    setSimulation(null);
    setSimulationResult(null);
  }

  async function markAnswer(question, selectedAnswer) {
    try {
      const response = await answerStudyQuestion(token, question.id, selectedAnswer);
      const patchQuestion = (item) => (
        item.id === question.id
          ? { ...item, selectedAnswer, isCorrect: response.isCorrect }
          : item
      );
      setQuestions((current) => current.map(patchQuestion));
      setSimulation((current) => current ? { ...current, questions: current.questions.map(patchQuestion) } : current);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function toggleFavorite(question) {
    try {
      const response = await favoriteStudyQuestion(token, question.id, !question.favorite);
      const patchQuestion = (item) => (
        item.id === question.id ? { ...item, favorite: response.favorite } : item
      );
      setQuestions((current) => current.map(patchQuestion));
      setSimulation((current) => current ? { ...current, questions: current.questions.map(patchQuestion) } : current);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function startSimulation() {
    if (!selectedContestId || !selectedRoleId) return;
    setQuestionsLoading(true);
    setSimulationResult(null);
    setSimulationAnswers({});
    try {
      const response = await fetchStudySimulation(token, selectedContestId, selectedRoleId);
      setSimulation(response);
      setMode("simulado");
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setQuestionsLoading(false);
    }
  }

  async function finishSimulation() {
    if (!simulation?.questions?.length || !selectedRole) return;
    const questionType = getRoleQuestionType(selectedRole);
    const result = simulation.questions.reduce((acc, question) => {
      const selectedAnswer = simulationAnswers[question.id] || "";
      if (!selectedAnswer) {
        acc.blankCount += 1;
        return acc;
      }
      const correct = selectedAnswer === question.correctAnswer;
      if (correct) acc.correctCount += 1;
      else acc.wrongCount += 1;
      acc.answers[question.id] = { selectedAnswer, correctAnswer: question.correctAnswer, correct };
      return acc;
    }, {
      totalQuestions: simulation.questions.length,
      correctCount: 0,
      wrongCount: 0,
      blankCount: 0,
      answers: {}
    });
    result.score = questionType === "certo_errado"
      ? result.correctCount - result.wrongCount
      : result.correctCount;
    result.maxScore = simulation.questions.length;

    try {
      await Promise.all(
        Object.entries(result.answers).map(([questionId, answer]) => (
          answerStudyQuestion(token, questionId, answer.selectedAnswer)
        ))
      );
      await createStudyAttempt(token, selectedContestId, selectedRole.id, {
        mode: "simulado-completo",
        ...result,
        details: {
          roleName: selectedRole.name,
          contestName: selectedContest?.name,
          questionType
        }
      });
      setSimulationResult(result);
      notify("Simulado finalizado e histórico salvo neste concurso.", "ok");
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function resetSimulation() {
    setSimulationAnswers({});
    setSimulationResult(null);
  }

  if (loading) {
    return <section className="panel study-shell"><p>Carregando concursos...</p></section>;
  }

  return (
    <section className="study-shell">
      <div className="study-hero panel">
        <div>
          <p className="eyebrow">Central de concursos</p>
          <h2>Escolha o edital e mantenha as estatísticas separadas.</h2>
          <p>
            Cada concurso possui questões, matérias, favoritos, respostas e tentativas próprias para {user?.name || "o usuário"}.
          </p>
        </div>
        <div className="study-hero__badge">
          <Trophy size={28} />
          <strong>{contests.reduce((sum, contest) => sum + contest.questionCount, 0)}</strong>
          <span>questões cadastradas</span>
        </div>
      </div>

      <div className="contest-card-grid">
        {contests.map((contest) => (
          <button
            type="button"
            key={contest.id}
            className={`contest-card${contest.id === selectedContestId ? " active" : ""}`}
            onClick={() => selectContest(contest.id)}
          >
            <span>{contest.status}</span>
            <strong>{contest.name}</strong>
            <small>{contest.primaryRole}</small>
            <dl>
              <div><dt>Banca</dt><dd>{contest.board}</dd></div>
              <div><dt>Prova</dt><dd>{formatDate(contest.examDate)}</dd></div>
              <div><dt>Questões</dt><dd>{contest.questionCount}</dd></div>
              <div><dt>Progresso</dt><dd>{contest.progressPercent}%</dd></div>
            </dl>
          </button>
        ))}
      </div>

      {selectedContest && overview && (
        <>
          <section className="panel study-overview">
            <div>
              <p className="eyebrow">{selectedContest.board}</p>
              <h2>{selectedContest.name}</h2>
              <p>{selectedContest.metadata?.focus}</p>
            </div>
            <div className="study-metrics">
              <span><strong>{selectedContest.questionCount}</strong> questões</span>
              <span><strong>{overview.contest.answeredCount}</strong> respondidas</span>
              <span><strong>{overview.contest.correctCount}</strong> certas</span>
              <span><strong>{overview.contest.wrongCount}</strong> erradas</span>
              <span><strong>{overview.contest.favoriteCount}</strong> favoritas</span>
            </div>
          </section>

          <section className="toolbar study-toolbar">
            <label>
              Cargo
              <select value={selectedRole?.id || ""} onChange={(event) => selectRole(event.target.value)}>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </label>
            <div className="segmented study-mode-tabs">
              <button type="button" className={mode === "materias" ? "active" : ""} onClick={() => setMode("materias")}>
                <BookOpen size={16} /> Questões por matéria
              </button>
              <button type="button" className={mode === "simulado" ? "active" : ""} onClick={startSimulation}>
                <ClipboardList size={16} /> Simulado completo
              </button>
              <button type="button" className={mode === "erradas" ? "active" : ""} onClick={() => setMode("erradas")}>
                <RotateCcw size={16} /> Revisão de erradas
              </button>
            </div>
          </section>

          {mode !== "simulado" && (
            <>
              <section className="panel study-filters">
                <div className="panel-heading">
                  <h2><Filter size={18} /> Filtros</h2>
                  <button type="button" className="ghost-button" onClick={() => setFilters(emptyFilters)}>Limpar filtros</button>
                </div>
                <div className="study-filter-grid">
                  <label>Matéria
                    <select value={filters.subjectId} onChange={(event) => setFilters({ ...filters, subjectId: event.target.value })}>
                      <option value="">Todas</option>
                      {roleSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>Dificuldade
                    <select value={filters.dificuldade} onChange={(event) => setFilters({ ...filters, dificuldade: event.target.value })}>
                      <option value="">Todas</option>
                      <option value="facil">Fácil</option>
                      <option value="medio">Médio</option>
                      <option value="dificil">Difícil</option>
                    </select>
                  </label>
                  <label>Status
                    <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                      <option value="">Todas</option>
                      <option value="respondidas">Respondidas</option>
                      <option value="nao-respondidas">Não respondidas</option>
                      <option value="corretas">Corretas</option>
                      <option value="erradas">Erradas</option>
                    </select>
                  </label>
                  <label>Favoritas
                    <select value={filters.favoritas} onChange={(event) => setFilters({ ...filters, favoritas: event.target.value })}>
                      <option value="">Todas</option>
                      <option value="true">Somente favoritas</option>
                      <option value="false">Não favoritas</option>
                    </select>
                  </label>
                  <label>Origem
                    <select value={filters.origem} onChange={(event) => setFilters({ ...filters, origem: event.target.value })}>
                      <option value="">Todas</option>
                      <option value="inedita">Inédita</option>
                      <option value="adaptada">Adaptada</option>
                      <option value="real">Real</option>
                    </select>
                  </label>
                  <label>Assunto
                    <input value={filters.assunto} onChange={(event) => setFilters({ ...filters, assunto: event.target.value })} placeholder="Ex.: LGPD, protocolo" />
                  </label>
                </div>
              </section>
              <QuestionList
                loading={questionsLoading}
                questions={questions}
                questionType={activeQuestionType}
                onAnswer={markAnswer}
                onFavorite={toggleFavorite}
              />
            </>
          )}

          {mode === "simulado" && (
            <section className="panel simulation-panel">
              <div className="panel-heading">
                <div>
                  <h2>Simulado completo — {selectedRole?.name}</h2>
                  <p>
                    {simulation?.durationMinutes || selectedRole?.examConfig?.durationMinutes || 0} min · {selectedRole?.examConfig?.scoring}
                  </p>
                </div>
                <div className="simulation-actions">
                  <button type="button" className="ghost-button" onClick={startSimulation}>Gerar novamente</button>
                  <button type="button" className="ghost-button" onClick={resetSimulation}>Reiniciar respostas</button>
                  <button type="button" className="primary-action small" onClick={finishSimulation} disabled={!simulation?.questions?.length}>
                    Finalizar simulado
                  </button>
                </div>
              </div>
              {questionsLoading && <p>Montando simulado...</p>}
              {simulationResult && (
                <div className="simulation-result">
                  <span><strong>{simulationResult.correctCount}</strong> acertos</span>
                  <span><strong>{simulationResult.wrongCount}</strong> erros</span>
                  <span><strong>{simulationResult.blankCount}</strong> brancos</span>
                  <span><strong>{simulationResult.score}</strong> pontos</span>
                </div>
              )}
              <div className="question-list">
                {(simulation?.questions || []).map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    number={index + 1}
                    question={{
                      ...question,
                      selectedAnswer: simulationAnswers[question.id] || question.selectedAnswer,
                      isCorrect: simulationResult
                        ? (simulationAnswers[question.id] ? simulationAnswers[question.id] === question.correctAnswer : null)
                        : question.isCorrect
                    }}
                    questionType={activeQuestionType}
                    reveal={Boolean(simulationResult)}
                    onAnswer={(_question, selectedAnswer) => setSimulationAnswers((current) => ({ ...current, [question.id]: selectedAnswer }))}
                    onFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="panel study-sources">
            <div>
              <p className="eyebrow">Fonte oficial utilizada</p>
              <h2>{overview.contest.sourceTitle}</h2>
              <a href={overview.contest.sourceUrl} target="_blank" rel="noreferrer">Abrir edital/fonte</a>
            </div>
            <p>{overview.contest.metadata?.style}</p>
          </section>
        </>
      )}
    </section>
  );
}

function QuestionList({ loading, questions, questionType, onAnswer, onFavorite }) {
  if (loading) return <section className="panel"><p>Carregando questões...</p></section>;
  if (!questions.length) {
    return (
      <section className="panel empty-state">
        <h2>Nenhuma questão encontrada</h2>
        <p>Ajuste os filtros ou responda mais questões para formar uma revisão de erradas.</p>
      </section>
    );
  }

  return (
    <section className="question-list">
      {questions.map((question, index) => (
        <QuestionCard
          key={question.id}
          number={index + 1}
          question={question}
          questionType={questionType}
          reveal={Boolean(question.selectedAnswer)}
          onAnswer={onAnswer}
          onFavorite={onFavorite}
        />
      ))}
    </section>
  );
}

function QuestionCard({ number, question, questionType, reveal, onAnswer, onFavorite }) {
  const alternatives = question.alternatives || [];
  return (
    <article className={`question-card${answerClass(question)}`}>
      <header>
        <div>
          <span>Questão {number} · {question.matter}</span>
          <strong>{question.topic}</strong>
        </div>
        <button type="button" className={`favorite-button${question.favorite ? " active" : ""}`} onClick={() => onFavorite(question)} title="Favoritar questão">
          <Star size={17} fill={question.favorite ? "currentColor" : "none"} />
        </button>
      </header>
      <p>{question.statement}</p>
      <div className={questionType === "certo_errado" ? "answer-options two" : "answer-options"}>
        {alternatives.map((alternative) => {
          const selected = question.selectedAnswer === alternative.key;
          const correct = reveal && question.correctAnswer === alternative.key;
          return (
            <button
              type="button"
              key={alternative.key}
              className={`${selected ? "selected" : ""}${correct ? " correct" : ""}`}
              onClick={() => onAnswer(question, alternative.key)}
            >
              <b>{alternative.key}</b>
              <span>{alternative.text}</span>
            </button>
          );
        })}
      </div>
      <footer>
        <span>{difficultyLabel(question.difficulty)}</span>
        <span>{question.board} · {question.referenceYear}</span>
        <span>{question.originType}</span>
        <span>{answerStatus(question)}</span>
      </footer>
      {reveal && (
        <details open className="question-explanation">
          <summary><CheckCircle2 size={16} /> Explicação e fonte</summary>
          <p><strong>Gabarito:</strong> {question.correctAnswer}</p>
          <p>{question.explanation}</p>
          <p><strong>Fonte:</strong> {question.source}</p>
          {question.sourceUrl && <a href={question.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte oficial</a>}
        </details>
      )}
    </article>
  );
}
