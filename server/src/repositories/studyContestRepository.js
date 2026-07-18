import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { getStudyQuestions, getStudySubjects, studyContestSeed } from "../data/studyContestSeed.js";

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function contestFromRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    primaryRole: row.primary_role,
    board: row.board,
    examDate: row.exam_date,
    status: row.status,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    metadata: parseJson(row.metadata, {}),
    questionCount: Number(row.question_count || 0),
    answeredCount: Number(row.answered_count || 0),
    correctCount: Number(row.correct_count || 0),
    wrongCount: Number(row.wrong_count || 0),
    favoriteCount: Number(row.favorite_count || 0),
    progressPercent: Number(row.question_count || 0)
      ? Math.round((Number(row.answered_count || 0) / Number(row.question_count || 0)) * 100)
      : 0
  };
}

function roleFromRow(row) {
  return {
    id: row.id,
    contestId: row.contest_id,
    slug: row.slug,
    name: row.name,
    level: row.level,
    questionTarget: Number(row.question_target || 0),
    examConfig: parseJson(row.exam_config, {}),
    questionCount: Number(row.question_count || 0),
    answeredCount: Number(row.answered_count || 0),
    correctCount: Number(row.correct_count || 0),
    wrongCount: Number(row.wrong_count || 0),
    progressPercent: Number(row.question_count || 0)
      ? Math.round((Number(row.answered_count || 0) / Number(row.question_count || 0)) * 100)
      : 0
  };
}

function subjectFromRow(row) {
  return {
    id: row.id,
    contestId: row.contest_id,
    roleId: row.role_id,
    slug: row.slug,
    name: row.name,
    weight: Number(row.weight || 1),
    sortOrder: Number(row.sort_order || 0),
    syllabus: parseJson(row.syllabus, []),
    questionCount: Number(row.question_count || 0),
    answeredCount: Number(row.answered_count || 0),
    correctCount: Number(row.correct_count || 0),
    wrongCount: Number(row.wrong_count || 0)
  };
}

function questionFromRow(row) {
  return {
    id: row.id,
    contestId: row.contest_id,
    roleId: row.role_id,
    subjectId: row.subject_id,
    cargo: row.cargo,
    matter: row.matter,
    topic: row.topic,
    statement: row.statement,
    alternatives: parseJson(row.alternatives, []),
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    difficulty: row.difficulty,
    board: row.board,
    referenceYear: Number(row.reference_year || 0),
    source: row.source,
    sourceUrl: row.source_url,
    originType: row.origin_type,
    selectedAnswer: row.selected_answer || null,
    isCorrect: typeof row.is_correct === "boolean" ? row.is_correct : null,
    answeredAt: row.answered_at || null,
    favorite: Boolean(row.favorite)
  };
}

export async function seedStudyContestCatalog() {
  const contests = studyContestSeed.contests;
  const roles = studyContestSeed.roles;
  const subjects = getStudySubjects();
  const questions = getStudyQuestions();

  await withTransaction(async (db) => {
    for (const contest of contests) {
      await db(
        `
          INSERT INTO study_contests (
            id, slug, name, primary_role, board, exam_date, status, source_title, source_url, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            slug = EXCLUDED.slug,
            name = EXCLUDED.name,
            primary_role = EXCLUDED.primary_role,
            board = EXCLUDED.board,
            exam_date = EXCLUDED.exam_date,
            status = EXCLUDED.status,
            source_title = EXCLUDED.source_title,
            source_url = EXCLUDED.source_url,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `,
        [
          contest.id,
          contest.slug,
          contest.name,
          contest.primaryRole,
          contest.board,
          contest.examDate,
          contest.status,
          contest.sourceTitle,
          contest.sourceUrl,
          JSON.stringify(contest.metadata || {})
        ]
      );
    }

    for (const role of roles) {
      await db(
        `
          INSERT INTO study_roles (
            id, contest_id, slug, name, level, question_target, exam_config
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            contest_id = EXCLUDED.contest_id,
            slug = EXCLUDED.slug,
            name = EXCLUDED.name,
            level = EXCLUDED.level,
            question_target = EXCLUDED.question_target,
            exam_config = EXCLUDED.exam_config,
            updated_at = NOW()
        `,
        [
          role.id,
          role.contestId,
          role.slug,
          role.name,
          role.level,
          role.questionTarget,
          JSON.stringify(role.examConfig || {})
        ]
      );
    }

    for (const subject of subjects) {
      await db(
        `
          INSERT INTO study_subjects (
            id, contest_id, role_id, slug, name, weight, sort_order, syllabus
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            contest_id = EXCLUDED.contest_id,
            role_id = EXCLUDED.role_id,
            slug = EXCLUDED.slug,
            name = EXCLUDED.name,
            weight = EXCLUDED.weight,
            sort_order = EXCLUDED.sort_order,
            syllabus = EXCLUDED.syllabus,
            updated_at = NOW()
        `,
        [
          subject.id,
          subject.contestId,
          subject.roleId,
          subject.slug,
          subject.name,
          subject.weight,
          subject.sortOrder,
          JSON.stringify(subject.syllabus || [])
        ]
      );
    }

    for (const questionItem of questions) {
      await db(
        `
          INSERT INTO study_questions (
            id, contest_id, role_id, subject_id, cargo, matter, topic, statement, alternatives,
            correct_answer, explanation, difficulty, board, reference_year, source, source_url, origin_type
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            contest_id = EXCLUDED.contest_id,
            role_id = EXCLUDED.role_id,
            subject_id = EXCLUDED.subject_id,
            cargo = EXCLUDED.cargo,
            matter = EXCLUDED.matter,
            topic = EXCLUDED.topic,
            statement = EXCLUDED.statement,
            alternatives = EXCLUDED.alternatives,
            correct_answer = EXCLUDED.correct_answer,
            explanation = EXCLUDED.explanation,
            difficulty = EXCLUDED.difficulty,
            board = EXCLUDED.board,
            reference_year = EXCLUDED.reference_year,
            source = EXCLUDED.source,
            source_url = EXCLUDED.source_url,
            origin_type = EXCLUDED.origin_type,
            updated_at = NOW()
        `,
        [
          questionItem.id,
          questionItem.contestId,
          questionItem.roleId,
          questionItem.subjectId,
          questionItem.cargo,
          questionItem.matter,
          questionItem.topic,
          questionItem.statement,
          JSON.stringify(questionItem.alternatives),
          questionItem.correctAnswer,
          questionItem.explanation,
          questionItem.difficulty,
          questionItem.board,
          questionItem.referenceYear,
          questionItem.source,
          questionItem.sourceUrl,
          questionItem.originType
        ]
      );
    }
  });
}

export async function listStudyContests(userId) {
  const result = await query(
    `
      WITH question_stats AS (
        SELECT contest_id, COUNT(*)::int AS question_count
        FROM study_questions
        GROUP BY contest_id
      ),
      answer_stats AS (
        SELECT
          contest_id,
          COUNT(DISTINCT question_id)::int AS answered_count,
          COUNT(DISTINCT CASE WHEN is_correct = TRUE THEN question_id END)::int AS correct_count,
          COUNT(DISTINCT CASE WHEN is_correct = FALSE THEN question_id END)::int AS wrong_count
        FROM study_user_answers
        WHERE user_id = $1
        GROUP BY contest_id
      ),
      favorite_stats AS (
        SELECT contest_id, COUNT(DISTINCT question_id)::int AS favorite_count
        FROM study_question_favorites
        WHERE user_id = $1
        GROUP BY contest_id
      )
      SELECT
        c.id,
        c.slug,
        c.name,
        c.primary_role,
        c.board,
        c.exam_date,
        c.status,
        c.source_title,
        c.source_url,
        c.metadata,
        c.created_at,
        c.updated_at,
        COALESCE(question_stats.question_count, 0)::int AS question_count,
        COALESCE(answer_stats.answered_count, 0)::int AS answered_count,
        COALESCE(answer_stats.correct_count, 0)::int AS correct_count,
        COALESCE(answer_stats.wrong_count, 0)::int AS wrong_count,
        COALESCE(favorite_stats.favorite_count, 0)::int AS favorite_count
      FROM study_contests c
      LEFT JOIN question_stats ON question_stats.contest_id = c.id
      LEFT JOIN answer_stats ON answer_stats.contest_id = c.id
      LEFT JOIN favorite_stats ON favorite_stats.contest_id = c.id
      ORDER BY c.name ASC
    `,
    [userId]
  );
  return result.rows.map(contestFromRow);
}

export async function getStudyContestOverview({ userId, contestId }) {
  const contestResult = await query(
    `
      WITH question_stats AS (
        SELECT contest_id, COUNT(*)::int AS question_count
        FROM study_questions
        GROUP BY contest_id
      ),
      answer_stats AS (
        SELECT
          contest_id,
          COUNT(DISTINCT question_id)::int AS answered_count,
          COUNT(DISTINCT CASE WHEN is_correct = TRUE THEN question_id END)::int AS correct_count,
          COUNT(DISTINCT CASE WHEN is_correct = FALSE THEN question_id END)::int AS wrong_count
        FROM study_user_answers
        WHERE user_id = $2
        GROUP BY contest_id
      ),
      favorite_stats AS (
        SELECT contest_id, COUNT(DISTINCT question_id)::int AS favorite_count
        FROM study_question_favorites
        WHERE user_id = $2
        GROUP BY contest_id
      )
      SELECT
        c.id,
        c.slug,
        c.name,
        c.primary_role,
        c.board,
        c.exam_date,
        c.status,
        c.source_title,
        c.source_url,
        c.metadata,
        c.created_at,
        c.updated_at,
        COALESCE(question_stats.question_count, 0)::int AS question_count,
        COALESCE(answer_stats.answered_count, 0)::int AS answered_count,
        COALESCE(answer_stats.correct_count, 0)::int AS correct_count,
        COALESCE(answer_stats.wrong_count, 0)::int AS wrong_count,
        COALESCE(favorite_stats.favorite_count, 0)::int AS favorite_count
      FROM study_contests c
      LEFT JOIN question_stats ON question_stats.contest_id = c.id
      LEFT JOIN answer_stats ON answer_stats.contest_id = c.id
      LEFT JOIN favorite_stats ON favorite_stats.contest_id = c.id
      WHERE c.id = $1 OR c.slug = $1
    `,
    [contestId, userId]
  );
  const contest = contestResult.rows[0] ? contestFromRow(contestResult.rows[0]) : null;
  if (!contest) return null;

  const rolesResult = await query(
    `
      WITH question_stats AS (
        SELECT role_id, COUNT(*)::int AS question_count
        FROM study_questions
        GROUP BY role_id
      ),
      answer_stats AS (
        SELECT
          role_id,
          COUNT(DISTINCT question_id)::int AS answered_count,
          COUNT(DISTINCT CASE WHEN is_correct = TRUE THEN question_id END)::int AS correct_count,
          COUNT(DISTINCT CASE WHEN is_correct = FALSE THEN question_id END)::int AS wrong_count
        FROM study_user_answers
        WHERE user_id = $2
        GROUP BY role_id
      )
      SELECT
        r.id,
        r.contest_id,
        r.slug,
        r.name,
        r.level,
        r.question_target,
        r.exam_config,
        r.created_at,
        r.updated_at,
        COALESCE(question_stats.question_count, 0)::int AS question_count,
        COALESCE(answer_stats.answered_count, 0)::int AS answered_count,
        COALESCE(answer_stats.correct_count, 0)::int AS correct_count,
        COALESCE(answer_stats.wrong_count, 0)::int AS wrong_count
      FROM study_roles r
      LEFT JOIN question_stats ON question_stats.role_id = r.id
      LEFT JOIN answer_stats ON answer_stats.role_id = r.id
      WHERE r.contest_id = $1
      ORDER BY r.name ASC
    `,
    [contest.id, userId]
  );

  const subjectsResult = await query(
    `
      WITH question_stats AS (
        SELECT subject_id, COUNT(*)::int AS question_count
        FROM study_questions
        GROUP BY subject_id
      ),
      answer_stats AS (
        SELECT
          q.subject_id,
          COUNT(DISTINCT a.question_id)::int AS answered_count,
          COUNT(DISTINCT CASE WHEN a.is_correct = TRUE THEN a.question_id END)::int AS correct_count,
          COUNT(DISTINCT CASE WHEN a.is_correct = FALSE THEN a.question_id END)::int AS wrong_count
        FROM study_user_answers a
        INNER JOIN study_questions q ON q.id = a.question_id
        WHERE a.user_id = $2
        GROUP BY q.subject_id
      )
      SELECT
        s.id,
        s.contest_id,
        s.role_id,
        s.slug,
        s.name,
        s.weight,
        s.sort_order,
        s.syllabus,
        s.created_at,
        s.updated_at,
        COALESCE(question_stats.question_count, 0)::int AS question_count,
        COALESCE(answer_stats.answered_count, 0)::int AS answered_count,
        COALESCE(answer_stats.correct_count, 0)::int AS correct_count,
        COALESCE(answer_stats.wrong_count, 0)::int AS wrong_count
      FROM study_subjects s
      LEFT JOIN question_stats ON question_stats.subject_id = s.id
      LEFT JOIN answer_stats ON answer_stats.subject_id = s.id
      WHERE s.contest_id = $1
      ORDER BY s.sort_order ASC
    `,
    [contest.id, userId]
  );

  const attemptsResult = await query(
    `
      SELECT *
      FROM study_exam_attempts
      WHERE user_id = $1 AND contest_id = $2
      ORDER BY created_at DESC
      LIMIT 8
    `,
    [userId, contest.id]
  );

  return {
    contest,
    roles: rolesResult.rows.map(roleFromRow),
    subjects: subjectsResult.rows.map(subjectFromRow),
    recentAttempts: attemptsResult.rows.map((row) => ({
      id: row.id,
      contestId: row.contest_id,
      roleId: row.role_id,
      mode: row.mode,
      totalQuestions: Number(row.total_questions || 0),
      correctCount: Number(row.correct_count || 0),
      wrongCount: Number(row.wrong_count || 0),
      blankCount: Number(row.blank_count || 0),
      score: Number(row.score || 0),
      maxScore: Number(row.max_score || 0),
      details: parseJson(row.details, {}),
      createdAt: row.created_at
    }))
  };
}

function buildQuestionWhere({ contestId, roleId, subjectId, matter, topic, board, difficulty, originType, status, favorite }, params, userId) {
  const conditions = ["q.contest_id = $1"];
  params.push(contestId);

  if (roleId) {
    params.push(roleId);
    conditions.push(`q.role_id = $${params.length}`);
  }
  if (subjectId) {
    params.push(subjectId);
    conditions.push(`q.subject_id = $${params.length}`);
  }
  if (matter) {
    params.push(`%${matter}%`);
    conditions.push(`q.matter ILIKE $${params.length}`);
  }
  if (topic) {
    params.push(`%${topic}%`);
    conditions.push(`q.topic ILIKE $${params.length}`);
  }
  if (board) {
    params.push(board);
    conditions.push(`q.board = $${params.length}`);
  }
  if (difficulty) {
    params.push(difficulty);
    conditions.push(`q.difficulty = $${params.length}`);
  }
  if (originType) {
    params.push(originType);
    conditions.push(`q.origin_type = $${params.length}`);
  }
  if (status === "respondidas") {
    conditions.push("a.question_id IS NOT NULL");
  }
  if (status === "nao-respondidas") {
    conditions.push("a.question_id IS NULL");
  }
  if (status === "corretas") {
    conditions.push("a.is_correct = TRUE");
  }
  if (status === "erradas") {
    conditions.push("a.is_correct = FALSE");
  }
  if (favorite === "true" || favorite === true) {
    conditions.push("f.question_id IS NOT NULL");
  }
  if (favorite === "false") {
    conditions.push("f.question_id IS NULL");
  }

  return { where: conditions.join(" AND "), userId };
}

export async function listStudyQuestions({ userId, contestId, filters = {}, limit = 80, randomize = false }) {
  const params = [];
  const { where } = buildQuestionWhere({ contestId, ...filters }, params, userId);
  params.push(userId);
  const userParam = params.length;
  params.push(Math.max(1, Math.min(Number(limit) || 80, 150)));
  const limitParam = params.length;
  const orderBy = randomize
    ? "q.subject_id ASC, q.id ASC"
    : "q.matter ASC, q.topic ASC, q.id ASC";

  const result = await query(
    `
      SELECT
        q.*,
        a.selected_answer,
        a.is_correct,
        a.answered_at,
        (f.question_id IS NOT NULL) AS favorite
      FROM study_questions q
      LEFT JOIN study_user_answers a ON a.question_id = q.id AND a.user_id = $${userParam}
      LEFT JOIN study_question_favorites f ON f.question_id = q.id AND f.user_id = $${userParam}
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${limitParam}
    `,
    params
  );

  return result.rows.map(questionFromRow);
}

export async function getStudySimulation({ userId, contestId, roleId }) {
  const roleResult = await query(
    "SELECT * FROM study_roles WHERE id = $1 AND contest_id = $2",
    [roleId, contestId]
  );
  const role = roleResult.rows[0] ? roleFromRow(roleResult.rows[0]) : null;
  if (!role) return null;

  const examConfig = role.examConfig || {};
  const target = Number(examConfig.completeSimulationQuestions || role.questionTarget || 50);
  const questions = await listStudyQuestions({
    userId,
    contestId,
    filters: { roleId },
    limit: target,
    randomize: true
  });

  return {
    role,
    questions,
    target,
    durationMinutes: Number(examConfig.durationMinutes || 180),
    scoring: examConfig.scoring || "1 ponto por acerto",
    approvalCriteria: examConfig.approvalCriteria || ""
  };
}

export async function answerStudyQuestion({ userId, questionId, selectedAnswer }) {
  const questionResult = await query("SELECT * FROM study_questions WHERE id = $1", [questionId]);
  const question = questionResult.rows[0];
  if (!question) return null;

  const normalizedAnswer = String(selectedAnswer || "").trim().toUpperCase();
  const isCorrect = normalizedAnswer === question.correct_answer;
  const answerId = randomUUID();

  const result = await query(
    `
      INSERT INTO study_user_answers (
        id, user_id, contest_id, role_id, question_id, selected_answer, is_correct
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, question_id) DO UPDATE SET
        selected_answer = EXCLUDED.selected_answer,
        is_correct = EXCLUDED.is_correct,
        answered_at = NOW()
      RETURNING *
    `,
    [
      answerId,
      userId,
      question.contest_id,
      question.role_id,
      question.id,
      normalizedAnswer,
      isCorrect
    ]
  );

  return {
    answer: result.rows[0],
    question: questionFromRow({ ...question, selected_answer: normalizedAnswer, is_correct: isCorrect, favorite: false }),
    isCorrect,
    correctAnswer: question.correct_answer
  };
}

export async function setStudyQuestionFavorite({ userId, questionId, favorite }) {
  const questionResult = await query("SELECT contest_id, role_id FROM study_questions WHERE id = $1", [questionId]);
  const question = questionResult.rows[0];
  if (!question) return null;

  if (favorite) {
    await query(
      `
        INSERT INTO study_question_favorites (user_id, question_id, contest_id, role_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, question_id) DO NOTHING
      `,
      [userId, questionId, question.contest_id, question.role_id]
    );
  } else {
    await query(
      "DELETE FROM study_question_favorites WHERE user_id = $1 AND question_id = $2",
      [userId, questionId]
    );
  }

  return { questionId, favorite: Boolean(favorite) };
}

export async function createStudyExamAttempt({ userId, contestId, roleId, payload }) {
  const details = payload.details && typeof payload.details === "object" ? payload.details : {};
  const result = await query(
    `
      INSERT INTO study_exam_attempts (
        id, user_id, contest_id, role_id, mode, total_questions, correct_count, wrong_count, blank_count,
        score, max_score, details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      RETURNING *
    `,
    [
      randomUUID(),
      userId,
      contestId,
      roleId,
      payload.mode || "simulado-completo",
      Number(payload.totalQuestions || 0),
      Number(payload.correctCount || 0),
      Number(payload.wrongCount || 0),
      Number(payload.blankCount || 0),
      Number(payload.score || 0),
      Number(payload.maxScore || 0),
      JSON.stringify(details)
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    contestId: row.contest_id,
    roleId: row.role_id,
    mode: row.mode,
    totalQuestions: Number(row.total_questions || 0),
    correctCount: Number(row.correct_count || 0),
    wrongCount: Number(row.wrong_count || 0),
    blankCount: Number(row.blank_count || 0),
    score: Number(row.score || 0),
    maxScore: Number(row.max_score || 0),
    details: parseJson(row.details, {}),
    createdAt: row.created_at
  };
}
