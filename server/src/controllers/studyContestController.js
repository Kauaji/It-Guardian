import {
  answerStudyQuestion,
  createStudyExamAttempt,
  getStudyContestOverview,
  getStudySimulation,
  listStudyContests,
  listStudyQuestions,
  setStudyQuestionFavorite
} from "../repositories/studyContestRepository.js";

function parseLimit(value, fallback = 80) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.round(parsed), 150);
}

export async function getContests(req, res, next) {
  try {
    const contests = await listStudyContests(req.user.id);
    res.json({ contests });
  } catch (error) {
    next(error);
  }
}

export async function getContestOverview(req, res, next) {
  try {
    const overview = await getStudyContestOverview({
      userId: req.user.id,
      contestId: req.params.contestId
    });
    if (!overview) {
      return res.status(404).json({ message: "Concurso nao encontrado." });
    }
    return res.json(overview);
  } catch (error) {
    return next(error);
  }
}

export async function getQuestions(req, res, next) {
  try {
    const questions = await listStudyQuestions({
      userId: req.user.id,
      contestId: req.params.contestId,
      filters: {
        roleId: req.query.roleId,
        subjectId: req.query.subjectId,
        matter: req.query.materia,
        topic: req.query.assunto,
        board: req.query.banca,
        difficulty: req.query.dificuldade,
        status: req.query.status,
        favorite: req.query.favoritas,
        originType: req.query.origem
      },
      limit: parseLimit(req.query.limit)
    });
    res.json({ questions });
  } catch (error) {
    next(error);
  }
}

export async function getWrongQuestions(req, res, next) {
  try {
    const questions = await listStudyQuestions({
      userId: req.user.id,
      contestId: req.params.contestId,
      filters: {
        roleId: req.query.roleId,
        subjectId: req.query.subjectId,
        status: "erradas",
        favorite: req.query.favoritas
      },
      limit: parseLimit(req.query.limit, 100)
    });
    res.json({ questions });
  } catch (error) {
    next(error);
  }
}

export async function getSimulation(req, res, next) {
  try {
    if (!req.query.roleId) {
      return res.status(400).json({ message: "Informe roleId para montar o simulado." });
    }
    const simulation = await getStudySimulation({
      userId: req.user.id,
      contestId: req.params.contestId,
      roleId: req.query.roleId
    });
    if (!simulation) {
      return res.status(404).json({ message: "Cargo do concurso nao encontrado." });
    }
    return res.json(simulation);
  } catch (error) {
    return next(error);
  }
}

export async function answerQuestion(req, res, next) {
  try {
    const { selectedAnswer } = req.body || {};
    if (!selectedAnswer) {
      return res.status(400).json({ message: "Informe uma alternativa." });
    }
    const result = await answerStudyQuestion({
      userId: req.user.id,
      questionId: req.params.questionId,
      selectedAnswer
    });
    if (!result) {
      return res.status(404).json({ message: "Questao nao encontrada." });
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function favoriteQuestion(req, res, next) {
  try {
    const result = await setStudyQuestionFavorite({
      userId: req.user.id,
      questionId: req.params.questionId,
      favorite: req.body?.favorite !== false
    });
    if (!result) {
      return res.status(404).json({ message: "Questao nao encontrada." });
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function saveExamAttempt(req, res, next) {
  try {
    const { contestId, roleId } = req.params;
    const attempt = await createStudyExamAttempt({
      userId: req.user.id,
      contestId,
      roleId,
      payload: req.body || {}
    });
    return res.status(201).json({ attempt });
  } catch (error) {
    return next(error);
  }
}
