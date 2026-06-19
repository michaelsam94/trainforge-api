-- TrainForge D1 schema v004 — workout logging

CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  plan_day_id TEXT NOT NULL REFERENCES plan_days (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')) DEFAULT 'in_progress',
  difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_idempotency
  ON workout_logs (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON workout_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_plan_day ON workout_logs (plan_day_id);

CREATE TABLE IF NOT EXISTS set_logs (
  id TEXT PRIMARY KEY,
  workout_log_id TEXT NOT NULL REFERENCES workout_logs (id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight_kg REAL,
  duration_seconds INTEGER,
  completed INTEGER NOT NULL DEFAULT 1,
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  idempotency_key TEXT,
  UNIQUE (workout_log_id, exercise_id, set_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_set_logs_idempotency
  ON set_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS plan_adaptations (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workout_log_id TEXT REFERENCES workout_logs (id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  load_multiplier REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
