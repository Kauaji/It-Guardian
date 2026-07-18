export const migration003StudyContests = {
  id: "003-study-contests",
  async up(db) {
    await db(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS username TEXT;
    `);

    await db(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
      ON users (username);
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS study_contests (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        primary_role TEXT NOT NULL,
        board TEXT NOT NULL,
        exam_date DATE,
        status TEXT NOT NULL,
        source_title TEXT NOT NULL,
        source_url TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS study_roles (
        id TEXT PRIMARY KEY,
        contest_id TEXT NOT NULL REFERENCES study_contests(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        level TEXT NOT NULL,
        question_target INTEGER NOT NULL DEFAULT 0,
        exam_config JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (contest_id, slug)
      );
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS study_subjects (
        id TEXT PRIMARY KEY,
        contest_id TEXT NOT NULL REFERENCES study_contests(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES study_roles(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        weight INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        syllabus JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (role_id, slug)
      );
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS study_questions (
        id TEXT PRIMARY KEY,
        contest_id TEXT NOT NULL REFERENCES study_contests(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES study_roles(id) ON DELETE CASCADE,
        subject_id TEXT NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
        cargo TEXT NOT NULL,
        matter TEXT NOT NULL,
        topic TEXT NOT NULL,
        statement TEXT NOT NULL,
        alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
        correct_answer TEXT NOT NULL,
        explanation TEXT NOT NULL,
        difficulty TEXT NOT NULL CHECK (difficulty IN ('facil', 'medio', 'dificil')),
        board TEXT NOT NULL,
        reference_year INTEGER NOT NULL,
        source TEXT NOT NULL,
        source_url TEXT,
        origin_type TEXT NOT NULL CHECK (origin_type IN ('real', 'adaptada', 'inedita')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db(`
      CREATE INDEX IF NOT EXISTS idx_study_questions_filters
      ON study_questions (contest_id, role_id, subject_id, difficulty, origin_type);
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS study_user_answers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contest_id TEXT NOT NULL REFERENCES study_contests(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES study_roles(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES study_questions(id) ON DELETE CASCADE,
        selected_answer TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, question_id)
      );
    `);

    await db(`
      CREATE INDEX IF NOT EXISTS idx_study_user_answers_scope
      ON study_user_answers (user_id, contest_id, role_id, is_correct, answered_at DESC);
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS study_question_favorites (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES study_questions(id) ON DELETE CASCADE,
        contest_id TEXT NOT NULL REFERENCES study_contests(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES study_roles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, question_id)
      );
    `);

    await db(`
      CREATE INDEX IF NOT EXISTS idx_study_favorites_scope
      ON study_question_favorites (user_id, contest_id, role_id, created_at DESC);
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS study_exam_attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contest_id TEXT NOT NULL REFERENCES study_contests(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES study_roles(id) ON DELETE CASCADE,
        mode TEXT NOT NULL,
        total_questions INTEGER NOT NULL,
        correct_count INTEGER NOT NULL,
        wrong_count INTEGER NOT NULL,
        blank_count INTEGER NOT NULL,
        score NUMERIC(10, 2) NOT NULL,
        max_score NUMERIC(10, 2) NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db(`
      CREATE INDEX IF NOT EXISTS idx_study_attempts_user_scope
      ON study_exam_attempts (user_id, contest_id, role_id, created_at DESC);
    `);
  }
};
